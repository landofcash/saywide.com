import { draftSurveyFromGoalInputSchema, generatedSurveyDraftSchema, type GeneratedSurveyDraft, type SurveyDraftInput } from "@saywide/contracts";

import type { TranscribeStreamController, TranscribeStreamOptions } from "./transcribe-stream";

export type CreationPhase = "idle" | "starting" | "recording" | "finishing" | "generating" | "error";
export interface CreationState { phase: CreationPhase; error: string; canRetry: boolean }
export const initialCreationState: CreationState = { phase: "idle", error: "", canRetry: false };

interface Dependencies {
  startStream(options: Omit<TranscribeStreamOptions, "createSession">): Promise<TranscribeStreamController>;
  generate(transcript: string, signal: AbortSignal): Promise<GeneratedSurveyDraft>;
  onState(state: CreationState): void;
  onDraft(draft: SurveyDraftInput): void;
}

// Transcript text stays inside this controller; only status and the structured draft reach the UI.
export function createSurveyCreation(deps: Dependencies) {
  let phase: CreationPhase = "idle";
  let attempt = 0;
  let disposed = false;
  let transcript = "";
  let partial = "";
  let canRetry = false;
  let stream: TranscribeStreamController | undefined;
  let request: AbortController | undefined;
  let recordingRequest: AbortController | undefined;

  function state(next: CreationPhase, error = "") {
    phase = next;
    if (!disposed) deps.onState({ phase, error, canRetry });
  }

  function reset() {
    attempt++;
    recordingRequest?.abort();
    recordingRequest = undefined;
    request?.abort();
    request = undefined;
    const previous = stream;
    stream = undefined;
    previous?.cancel();
    transcript = "";
    partial = "";
    canRetry = false;
  }

  function failRecording(message: string) {
    reset();
    state("error", message);
  }

  async function generate(id: number) {
    const input = draftSurveyFromGoalInputSchema.safeParse({ transcript });
    if (!input.success) {
      failRecording("We need a little more detail. Record your topic and the questions you would like to ask.");
      return;
    }
    canRetry = false;
    state("generating");
    request = new AbortController();
    try {
      const draft = generatedSurveyDraftSchema.parse(await deps.generate(input.data.transcript, request.signal));
      if (disposed || id !== attempt) return;
      transcript = "";
      partial = "";
      request = undefined;
      state("idle");
      deps.onDraft({
        ...draft,
        questions: draft.questions.map((question, position) => ({ ...question, position })),
        settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 },
      });
    } catch (error) {
      if (disposed || id !== attempt) return;
      request = undefined;
      const needsDescription = (error as { code?: string })?.code === "SURVEY_DESCRIPTION_INSUFFICIENT";
      canRetry = !needsDescription;
      if (needsDescription) transcript = "";
      state("error", needsDescription
        ? "Please record a clearer description of your topic and the questions you want to ask, up to 20 questions."
        : "We could not prepare your survey. Retry using your recording, or record a new description.");
    }
  }

  return {
    async start() {
      if (disposed || !["idle", "error"].includes(phase)) return;
      reset();
      const id = attempt;
      state("starting");
      recordingRequest = new AbortController();
      let ended = false;
      try {
        const nextStream = await deps.startStream({
          signal: recordingRequest.signal,
          onTranscript(update) {
            if (disposed || id !== attempt || ended) return;
            transcript = update.finalizedText;
            partial = update.partialText;
            if (transcript.length + partial.length > 12000) {
              failRecording("That description is too long. Please record a shorter version focused on your topic and questions.");
            }
          },
          onError() {
            if (disposed || id !== attempt) return;
            failRecording("Recording was interrupted. Check your connection and record again, or start manually.");
          },
          onEnded(reason) {
            if (ended) return;
            ended = true;
            if (disposed || id !== attempt) return;
            stream = undefined;
            if ((reason !== "stopped" && reason !== "limit") || (reason === "stopped" && phase !== "finishing") || partial.trim()) {
              failRecording("We could not finish your recording. Please record again, or start manually.");
              return;
            }
            void generate(id);
          },
        });
        if (disposed || id !== attempt || ended) { nextStream.cancel(); return; }
        stream = nextStream;
        state("recording");
      } catch (error) {
        if (disposed || id !== attempt) return;
        const denied = error instanceof Error && /denied|NotAllowedError/i.test(error.message);
        failRecording(denied
          ? "Microphone access was denied. Allow access in your browser and try again, or start manually."
          : "We could not start recording. Check microphone access and your connection, or start manually.");
      }
    },
    stop() {
      if (disposed || phase !== "recording") return;
      state("finishing");
      stream?.stop();
    },
    retry() {
      if (disposed || phase !== "error" || !canRetry) return;
      void generate(++attempt);
    },
    cancel() {
      if (disposed) return;
      reset();
      state("idle");
    },
    dispose() {
      disposed = true;
      reset();
    },
  };
}
