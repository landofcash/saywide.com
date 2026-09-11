import { afterEach, describe, expect, it, vi } from "vitest";

import { downsampleToPcm16, encodeAudioEvent, startTranscribeStream } from "./transcribe-stream";

afterEach(() => vi.unstubAllGlobals());

describe("recording startup cancellation", () => {
  it("stops tracks immediately when cancelled while the signed session is pending", async () => {
    const stop = vi.fn();
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
    let resolve!: (value: { websocketUrl: string; expiresAt: string; recordingLimitSeconds: number }) => void;
    const createSession = vi.fn(() => new Promise<{ websocketUrl: string; expiresAt: string; recordingLimitSeconds: number }>(r => { resolve = r; }));
    const request = new AbortController();
    const onEnded = vi.fn();
    const pending = startTranscribeStream({ signal: request.signal, createSession, onTranscript: vi.fn(), onError: vi.fn(), onEnded });
    await vi.waitFor(() => expect(createSession).toHaveBeenCalled());
    request.abort();
    expect(stop).toHaveBeenCalled();
    resolve({ websocketUrl: "wss://unused.example", expiresAt: "", recordingLimitSeconds: 120 });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(onEnded).toHaveBeenCalledExactlyOnceWith("cancelled");
  });

  it("releases a microphone granted after cancellation without opening a session", async () => {
    const stop = vi.fn();
    let resolve!: (value: { getTracks(): { stop(): void }[] }) => void;
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } });
    const request = new AbortController();
    const createSession = vi.fn();
    const pending = startTranscribeStream({ signal: request.signal, createSession, onTranscript: vi.fn(), onError: vi.fn(), onEnded: vi.fn() });
    request.abort();
    resolve({ getTracks: () => [{ stop }] });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(stop).toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("Transcribe audio encoding", () => {
  it("downsamples microphone floats to signed 16-bit little-endian PCM", () => {
    const pcm = downsampleToPcm16(new Float32Array([-1, -1, -1, 1, 1, 1]), 48_000, 16_000);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);

    expect(pcm.byteLength).toBe(4);
    expect(view.getInt16(0, true)).toBe(-32_768);
    expect(view.getInt16(2, true)).toBe(32_767);
  });

  it("wraps PCM bytes in an AWS event-stream AudioEvent frame", () => {
    const message = encodeAudioEvent(new Uint8Array([1, 2, 3, 4]));
    const view = new DataView(message.buffer, message.byteOffset, message.byteLength);

    expect(view.getUint32(0)).toBe(message.byteLength);
    expect(message.byteLength).toBeGreaterThan(4);
  });
});
