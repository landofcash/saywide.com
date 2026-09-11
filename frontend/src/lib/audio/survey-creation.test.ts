import { describe, expect, it, vi } from "vitest";
import type { GeneratedSurveyDraft } from "@saywide/contracts";
import { createSurveyCreation } from "./survey-creation";
import type { TranscribeStreamOptions } from "./transcribe-stream";

const draft: GeneratedSurveyDraft = { title: "Team feedback", introduction: "Tell us about team meetings.", questions: [{ prompt: "What should we improve?", required: true }] };
const spoken = "I want to know how our team meetings could be improved.";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function setup() {
  let callbacks!: Omit<TranscribeStreamOptions, "createSession">;
  const stream = { stop: vi.fn(), cancel: vi.fn() };
  const startStream = vi.fn(async (options: Omit<TranscribeStreamOptions, "createSession">) => { callbacks = options; return stream; });
  const generate = vi.fn(async (): Promise<GeneratedSurveyDraft> => structuredClone(draft));
  const onState = vi.fn();
  const onDraft = vi.fn();
  const flow = createSurveyCreation({ startStream, generate, onState, onDraft });
  return { flow, startStream, stream, generate, onState, onDraft, callbacks: () => callbacks };
}

describe("voice survey creation", () => {
  it("waits for final transcription, generates once, and emits an unsaved draft without leaking speech to status", async () => {
    const s = setup();
    await s.flow.start();
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "and" });
    s.flow.stop();
    s.flow.stop();
    expect(s.generate).not.toHaveBeenCalled();
    s.callbacks().onTranscript({ finalizedText: spoken + " And ask about frequency.", partialText: "" });
    s.callbacks().onEnded("stopped");
    s.callbacks().onEnded("stopped");
    await flush();
    expect(s.startStream).toHaveBeenCalledTimes(1);
    expect(s.stream.stop).toHaveBeenCalledTimes(1);
    expect(s.generate).toHaveBeenCalledExactlyOnceWith(spoken + " And ask about frequency.", expect.any(AbortSignal));
    expect(s.onDraft).toHaveBeenCalledWith({ ...draft, questions: [{ ...draft.questions[0], position: 0 }], settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 } });
    expect(JSON.stringify(s.onState.mock.calls)).not.toContain(spoken);
  });

  it.each(["cancel", "dispose"] as const)("%s aborts recording and ignores late transcripts", async method => {
    const s = setup();
    await s.flow.start();
    s.flow[method]();
    expect(s.callbacks().signal?.aborted).toBe(true);
    expect(s.stream.cancel).toHaveBeenCalledOnce();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "" });
    s.callbacks().onEnded("stopped");
    await flush();
    expect(s.generate).not.toHaveBeenCalled();
  });

  it("cancels a pending microphone startup and disposes a late stream", async () => {
    const s = setup();
    let resolve!: (value: typeof s.stream) => void;
    s.startStream.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = s.flow.start();
    s.flow.cancel();
    resolve(s.stream);
    await pending;
    expect(s.stream.cancel).toHaveBeenCalledOnce();
    expect(s.onState.mock.lastCall?.[0].phase).toBe("idle");
  });

  it.each(["silence", "partial", "error", "unexpected-close"])("does not generate from %s", async mode => {
    const s = setup();
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: mode === "silence" ? "" : spoken, partialText: mode === "partial" ? "unfinished" : "" });
    if (mode !== "unexpected-close") s.flow.stop();
    if (mode === "error") s.callbacks().onError(new Error("private provider detail"));
    s.callbacks().onEnded("stopped");
    await flush();
    expect(s.generate).not.toHaveBeenCalled();
    expect(s.onState.mock.lastCall?.[0]).toMatchObject({ phase: "error", canRetry: false });
    expect(JSON.stringify(s.onState.mock.calls)).not.toContain("private provider detail");
  });

  it("processes finalized speech when the recording limit is reached", async () => {
    const s = setup();
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "" });
    s.callbacks().onEnded("limit");
    await flush();
    expect(s.onDraft).toHaveBeenCalledOnce();
  });

  it("retries generation from memory without another recording or duplicate request", async () => {
    const s = setup();
    s.generate.mockRejectedValueOnce(new Error("timeout"));
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "" });
    s.flow.stop();
    s.callbacks().onEnded("stopped");
    await flush();
    expect(s.onState.mock.lastCall?.[0].canRetry).toBe(true);
    s.flow.retry();
    s.flow.retry();
    await flush();
    expect(s.generate).toHaveBeenCalledTimes(2);
    expect(s.startStream).toHaveBeenCalledOnce();
    expect(s.onDraft).toHaveBeenCalledOnce();
  });

  it("ignores a generation response after cancel and aborts the request", async () => {
    const s = setup();
    let resolve!: (value: GeneratedSurveyDraft) => void;
    s.generate.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "" });
    s.flow.stop();
    s.callbacks().onEnded("stopped");
    const call = s.generate.mock.calls[0] as unknown as [string, AbortSignal];
    s.flow.cancel();
    expect(call[1].aborted).toBe(true);
    resolve(draft);
    await flush();
    expect(s.onDraft).not.toHaveBeenCalled();
  });

  it("requires a new recording for insufficient context", async () => {
    const s = setup();
    s.generate.mockRejectedValueOnce({ code: "SURVEY_DESCRIPTION_INSUFFICIENT" });
    await s.flow.start();
    s.callbacks().onTranscript({ finalizedText: spoken, partialText: "" });
    s.flow.stop();
    s.callbacks().onEnded("stopped");
    await flush();
    expect(s.onState.mock.lastCall?.[0].canRetry).toBe(false);
    s.flow.retry();
    expect(s.generate).toHaveBeenCalledOnce();
  });
});
