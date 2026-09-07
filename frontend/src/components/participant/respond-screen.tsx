"use client";

import type { ParticipantAnswers, PublicSurvey } from "@saywide/contracts";
import { ArrowLeft, ArrowRight, AudioLines, Keyboard, Mic, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form-controls";
import { api, apiCapabilities, isMockApi } from "@/lib/api";
import {
  startTranscribeStream,
  type TranscribeStreamController,
  type TranscriptionEndReason,
} from "@/lib/audio/transcribe-stream";

const demoTranscript = "I appreciated having clear ownership, but the handoffs after meetings often left me unsure about the next step.";
type RecordingState = "idle" | "starting" | "recording" | "stopping";

function appendTranscript(existing: string, finalizedText: string, partialText: string): string {
  const transcript = [finalizedText, partialText].filter(Boolean).join(" ");
  if (!transcript) return existing;
  return existing ? `${existing.trimEnd()}\n${transcript}` : transcript;
}

export function RespondScreen({ publicToken, initialQuestion = 1 }: { publicToken: string; initialQuestion?: number }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<ParticipantAnswers>({});
  const [index, setIndex] = useState(Math.max(0, initialQuestion - 1));
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");
  const [error, setError] = useState("");
  const transcriptionRef = useRef<TranscribeStreamController | undefined>(undefined);
  const voiceBaselineRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    void Promise.all([api.getPublicSurvey(publicToken), api.readAnswers(publicToken)]).then(([surveyItem, answerItems]) => {
      setSurvey(surveyItem);
      setAnswers(answerItems);
      setIndex((current) => Math.min(current, surveyItem.questions.length - 1));
    });
  }, [publicToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      transcriptionRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (recordingState !== "recording") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [recordingState]);

  if (!survey) return <ParticipantShell><div className="h-[34rem] animate-pulse rounded-xl bg-[var(--canvas)]" /></ParticipantShell>;
  const question = survey.questions[index];
  const answer = answers[question.questionId] ?? "";
  const canContinue = !question.required || answer.trim().length > 0;
  const recordingActive = recordingState !== "idle";

  async function persist(value = answer) {
    setSaveState("saving");
    setError("");
    try {
      await api.saveAnswer(publicToken, question.questionId, value);
      setSaveState("saved");
      return true;
    } catch (reason) {
      setSaveState("idle");
      setError(reason instanceof Error ? reason.message : "Your answer could not be saved. Please try again.");
      return false;
    }
  }

  async function next() {
    if (!canContinue || recordingActive) return;
    if (!await persist()) return;
    if (index === survey!.questions.length - 1) router.push(`/s/${publicToken}/review`);
    else {
      setIndex((current) => current + 1);
      setSaveState("idle");
    }
  }

  async function previous() {
    if (recordingActive || !await persist()) return;
    setIndex((current) => Math.max(0, current - 1));
    setSaveState("idle");
  }

  async function startRecording() {
    setError("");
    setSaveState("idle");
    setRecordingSeconds(0);
    voiceBaselineRef.current = answer;
    if (isMockApi) {
      setRecordingState("recording");
      return;
    }

    setRecordingState("starting");
    try {
      const questionId = question.questionId;
      const controller = await startTranscribeStream({
        createSession: () => api.createTranscriptionSession(publicToken, questionId),
        onTranscript: ({ finalizedText, partialText }) => {
          if (!mountedRef.current) return;
          const nextAnswer = appendTranscript(voiceBaselineRef.current, finalizedText, partialText);
          setAnswers((current) => ({ ...current, [questionId]: nextAnswer }));
        },
        onError: (reason) => {
          if (mountedRef.current) setError(reason.message);
        },
        onEnded: (reason: TranscriptionEndReason) => {
          if (!mountedRef.current) return;
          transcriptionRef.current = undefined;
          setRecordingSeconds(0);
          setRecordingState("idle");
          if (reason === "limit") {
            setError("Recording stopped at the two-minute limit. You can review or continue by typing.");
          }
        },
      });
      if (!mountedRef.current) {
        controller.cancel();
        return;
      }
      transcriptionRef.current = controller;
      setRecordingState("recording");
    } catch (reason) {
      if (!mountedRef.current) return;
      setRecordingSeconds(0);
      setRecordingState("idle");
      setError(reason instanceof Error ? reason.message : "Voice transcription could not be started. You can continue by typing.");
    }
  }

  function stopRecording() {
    if (isMockApi) {
      setRecordingSeconds(0);
      setRecordingState("idle");
      const nextAnswer = answer ? `${answer}\n${demoTranscript}` : demoTranscript;
      setAnswers((current) => ({ ...current, [question.questionId]: nextAnswer }));
      return;
    }
    setRecordingState("stopping");
    transcriptionRef.current?.stop();
  }

  function cancelRecording() {
    if (!isMockApi) transcriptionRef.current?.cancel();
    transcriptionRef.current = undefined;
    setAnswers((current) => ({ ...current, [question.questionId]: voiceBaselineRef.current }));
    setRecordingSeconds(0);
    setRecordingState("idle");
    setSaveState("idle");
  }

  const recordingLabel = recordingState === "starting"
    ? "Connecting..."
    : recordingState === "stopping"
      ? "Finishing transcript..."
      : recordingState === "recording"
        ? `Listening... ${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`
        : "Prefer to speak?";

  return (
    <ParticipantShell>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold">Question {index + 1} of {survey.questions.length}</p>
        <p className="text-xs font-semibold text-[var(--muted)]" aria-live="polite">
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved on this device" : "Draft stays on this device"}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--canvas)]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={survey.questions.length}>
        <div className="h-full rounded-full bg-[var(--coral)] transition-all" style={{ width: `${((index + 1) / survey.questions.length) * 100}%` }} />
      </div>
      <Card className="mt-7 p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral-dark)]">{question.required ? "Answer required" : "Optional"}</p>
            <h1 className="font-display mt-3 text-3xl font-bold leading-tight tracking-[-0.025em]">{question.prompt}</h1>
          </div>
          <span className="hidden size-11 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--canvas)] sm:grid">{index + 1}</span>
        </div>
        <Textarea
          aria-label="Your answer"
          rows={9}
          value={answer}
          disabled={recordingActive}
          onChange={(event) => {
            setAnswers((current) => ({ ...current, [question.questionId]: event.target.value }));
            setSaveState("idle");
          }}
          placeholder="Write what comes to mind. You can edit this before submitting."
          className="mt-7 min-h-56 text-base leading-7"
        />
        {apiCapabilities.voice && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-lg border border-[var(--line)] ${recordingActive ? "bg-[var(--coral)] text-white" : "bg-white"}`}>
                {recordingActive ? <AudioLines className="size-5 animate-pulse" /> : <Keyboard className="size-5" />}
              </span>
              <div>
                <p className="text-sm font-bold">{recordingLabel}</p>
                <p className="text-xs text-[var(--muted)]">{recordingActive ? "The transcript will stay editable after you stop." : "Audio is transcribed live and not stored."}</p>
              </div>
            </div>
            {recordingActive ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelRecording} disabled={recordingState === "stopping"}><RotateCcw className="size-4" /> Cancel</Button>
                <Button variant="accent" size="sm" onClick={stopRecording} disabled={recordingState !== "recording"}><Square className="size-3 fill-current" /> Stop</Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void startRecording()}><Mic className="size-4" /> Answer by voice</Button>
            )}
          </div>
        )}
        <p className="mt-4 min-h-5 text-sm text-red-700" role="alert">{error}</p>
      </Card>
      <p className="mb-20 mt-5 text-center text-xs leading-5 text-[var(--muted)] sm:mb-0">Only the text you approve on the review screen will be submitted.</p>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white p-3 shadow-[0_-4px_14px_rgba(16,24,21,0.06)] sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-3xl justify-between gap-3">
          <Button variant="ghost" onClick={previous} disabled={index === 0 || recordingActive}><ArrowLeft className="size-4" /> Previous</Button>
          <Button variant="accent" onClick={next} disabled={!canContinue || recordingActive}>{index === survey.questions.length - 1 ? "Review answers" : "Next question"}<ArrowRight className="size-4" /></Button>
        </div>
      </div>
    </ParticipantShell>
  );
}
