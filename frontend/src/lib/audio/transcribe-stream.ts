import { EventStreamCodec } from "@smithy/eventstream-codec";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import type { TranscriptionSessionResponse } from "@saywide/contracts";

const OUTPUT_SAMPLE_RATE = 16_000;
const AUDIO_CHUNK_BYTES = 3_200;
const SOCKET_OPEN_TIMEOUT_MS = 10_000;
const SOCKET_CLOSE_GRACE_MS = 3_000;

const eventStreamCodec = new EventStreamCodec(toUtf8, fromUtf8);

export interface TranscriptUpdate {
  finalizedText: string;
  partialText: string;
}

export type TranscriptionEndReason = "stopped" | "limit" | "cancelled" | "error";

export interface TranscribeStreamOptions {
  signal?: AbortSignal;
  createSession(): Promise<TranscriptionSessionResponse>;
  onTranscript(update: TranscriptUpdate): void;
  onError(error: Error): void;
  onEnded(reason: TranscriptionEndReason): void;
}

export interface TranscribeStreamController {
  stop(): void;
  cancel(): void;
}

interface TranscriptResult {
  ResultId?: string;
  IsPartial?: boolean;
  StartTime?: number;
  Alternatives?: Array<{ Transcript?: string }>;
}

interface TranscriptEventBody {
  Transcript?: { Results?: TranscriptResult[] };
  Message?: string;
}

export function downsampleToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = OUTPUT_SAMPLE_RATE,
): Uint8Array {
  if (inputSampleRate < outputSampleRate) {
    throw new Error(`Microphone sample rate ${inputSampleRate} Hz is below ${outputSampleRate} Hz.`);
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Uint8Array(outputLength * 2);
  const view = new DataView(output.buffer);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.max(start + 1, Math.min(input.length, Math.floor((outputIndex + 1) * ratio)));
    let total = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) total += input[inputIndex];
    const sample = Math.max(-1, Math.min(1, total / (end - start)));
    view.setInt16(outputIndex * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return output;
}

export function encodeAudioEvent(pcm: Uint8Array): Uint8Array {
  return eventStreamCodec.encode({
    headers: {
      ":content-type": { type: "string", value: "application/octet-stream" },
      ":event-type": { type: "string", value: "AudioEvent" },
      ":message-type": { type: "string", value: "event" },
    },
    body: pcm,
  });
}

function appendBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length === 0) return right;
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function errorFromUnknown(reason: unknown): Error {
  if (reason instanceof DOMException && reason.name === "NotAllowedError") {
    return new Error("Microphone access was denied. You can continue by typing your answer.");
  }
  if (reason instanceof Error) return reason;
  return new Error("Voice transcription could not be started. You can continue by typing your answer.");
}

export async function startTranscribeStream(options: TranscribeStreamOptions): Promise<TranscribeStreamController> {
  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    throw new Error("Microphone access requires a secure HTTPS connection.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not provide microphone access. You can continue by typing your answer.");
  }

  let mediaStream: MediaStream | undefined;
  let audioContext: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: ScriptProcessorNode | undefined;
  let socket: WebSocket | undefined;
  let recordingTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingPcm: Uint8Array = new Uint8Array();
  let stoppingReason: Exclude<TranscriptionEndReason, "error"> | undefined;
  let ended = false;
  const finalizedSegments = new Map<string, string>();

  const stopAudioCapture = () => {
    if (processor) {
      processor.onaudioprocess = null;
      processor.disconnect();
    }
    source?.disconnect();
    for (const track of mediaStream?.getTracks() ?? []) track.stop();
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
  };

  const finish = (reason: TranscriptionEndReason) => {
    if (ended) return;
    ended = true;
    options.signal?.removeEventListener("abort", cancelFromSignal);
    if (recordingTimer) clearTimeout(recordingTimer);
    if (closeTimer) clearTimeout(closeTimer);
    stopAudioCapture();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000);
    options.onEnded(reason);
  };

  const cancelFromSignal = () => finish("cancelled");
  const checkCancelled = () => {
    if (options.signal?.aborted) throw new DOMException("Recording cancelled", "AbortError");
  };

  const reportError = (reason: unknown) => {
    const error = errorFromUnknown(reason);
    options.onError(error);
    finish("error");
  };

  const sendAudio = (pcm: Uint8Array) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    const encoded = encodeAudioEvent(pcm);
    const browserBuffer = new Uint8Array(encoded.byteLength);
    browserBuffer.set(encoded);
    socket.send(browserBuffer.buffer);
  };

  const requestStop = (reason: Exclude<TranscriptionEndReason, "error" | "cancelled">) => {
    if (ended || stoppingReason) return;
    stoppingReason = reason;
    if (recordingTimer) clearTimeout(recordingTimer);
    stopAudioCapture();
    if (socket?.readyState === WebSocket.OPEN) {
      if (pendingPcm.length > 0) sendAudio(pendingPcm);
      pendingPcm = new Uint8Array();
      sendAudio(new Uint8Array());
      closeTimer = setTimeout(() => finish(reason), SOCKET_CLOSE_GRACE_MS);
    } else {
      finish(reason);
    }
  };

  try {
    checkCancelled();
    options.signal?.addEventListener("abort", cancelFromSignal, { once: true });
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    checkCancelled();
    const session = await options.createSession();
    checkCancelled();
    socket = new WebSocket(session.websocketUrl);
    socket.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", aborted);
      };
      const aborted = () => { cleanup(); reject(new DOMException("Recording cancelled", "AbortError")); };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Amazon Transcribe did not accept the connection in time."));
      }, SOCKET_OPEN_TIMEOUT_MS);
      const opened = () => {
        cleanup();
        socket?.removeEventListener("error", failed);
        resolve();
      };
      const failed = () => {
        cleanup();
        socket?.removeEventListener("open", opened);
        reject(new Error("Amazon Transcribe could not open the streaming connection."));
      };
      socket?.addEventListener("open", opened, { once: true });
      socket?.addEventListener("error", failed, { once: true });
      options.signal?.addEventListener("abort", aborted, { once: true });
    });
    checkCancelled();

    socket.addEventListener("message", (event: MessageEvent<ArrayBuffer>) => {
      if (ended) return;
      try {
        const message = eventStreamCodec.decode(new Uint8Array(event.data));
        const messageType = message.headers[":message-type"]?.value;
        const body = JSON.parse(toUtf8(message.body)) as TranscriptEventBody;
        if (messageType === "exception") {
          reportError(new Error(body.Message ?? "Amazon Transcribe ended the stream with an error."));
          return;
        }
        if (message.headers[":event-type"]?.value !== "TranscriptEvent") return;

        let partialText = "";
        for (const result of body.Transcript?.Results ?? []) {
          const transcript = result.Alternatives?.[0]?.Transcript?.trim();
          if (!transcript) continue;
          if (result.IsPartial) {
            partialText = transcript;
          } else {
            const key = result.ResultId ?? `${result.StartTime ?? finalizedSegments.size}`;
            finalizedSegments.set(key, transcript);
          }
        }
        options.onTranscript({
          finalizedText: [...finalizedSegments.values()].join(" ").trim(),
          partialText,
        });
      } catch (error) {
        reportError(error);
      }
    });
    socket.addEventListener("error", () => reportError(new Error("The Amazon Transcribe connection failed.")));
    socket.addEventListener("close", (event) => {
      if (ended) return;
      if (stoppingReason) finish(stoppingReason);
      else if (event.code === 1000) finish("stopped");
      else reportError(new Error(event.reason || "The Amazon Transcribe connection closed unexpectedly."));
    });

    audioContext = new AudioContext();
    await audioContext.resume();
    checkCancelled();
    source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(2_048, 1, 1);
    processor.onaudioprocess = (event) => {
      const pcm = downsampleToPcm16(event.inputBuffer.getChannelData(0), audioContext!.sampleRate);
      pendingPcm = appendBytes(pendingPcm, pcm);
      while (pendingPcm.length >= AUDIO_CHUNK_BYTES) {
        sendAudio(pendingPcm.slice(0, AUDIO_CHUNK_BYTES));
        pendingPcm = pendingPcm.slice(AUDIO_CHUNK_BYTES);
      }
      event.outputBuffer.getChannelData(0).fill(0);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
    recordingTimer = setTimeout(() => requestStop("limit"), session.recordingLimitSeconds * 1000);

    return {
      stop: () => requestStop("stopped"),
      cancel: () => {
        if (ended) return;
        stoppingReason = "cancelled";
        finish("cancelled");
      },
    };
  } catch (error) {
    options.signal?.removeEventListener("abort", cancelFromSignal);
    stopAudioCapture();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000);
    throw errorFromUnknown(error);
  }
}
