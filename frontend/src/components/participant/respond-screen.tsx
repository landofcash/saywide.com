"use client";

import type { ParticipantAnswers, PublicSurvey } from "@saywide/contracts";
import { ArrowLeft, ArrowRight, LoaderCircle, Mic, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import styles from "@/components/participant/respond-screen.module.css";
import { Button } from "@/components/ui/button";
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
  const [inputRevealed, setInputRevealed] = useState(false);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const microphoneRef = useRef<HTMLButtonElement>(null);
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
  const showVoiceInvitation = apiCapabilities.voice && !inputRevealed && !answer.trim();

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
    if (recordingActive) return;
    setInputRevealed(true);
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
          if (nextAnswer.trim()) setInputRevealed(true);
          setAnswers((current) => ({ ...current, [questionId]: nextAnswer }));
        },
        onError: (reason) => {
          if (mountedRef.current) {
            setInputRevealed(true);
            setError(reason.message);
          }
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
      window.requestAnimationFrame(() => microphoneRef.current?.focus({ preventScroll: true }));
    } catch (reason) {
      if (!mountedRef.current) return;
      setInputRevealed(true);
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
        : "";

  return (
    <ParticipantShell>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold">Question {index + 1} of {survey.questions.length}</p>
        <p className="text-xs font-semibold text-[var(--muted)]" aria-live="polite">
          {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved on this device" : ""}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--canvas)]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={survey.questions.length}>
        <div className="h-full rounded-full bg-[var(--coral)] transition-all" style={{ width: `${((index + 1) / survey.questions.length) * 100}%` }} />
      </div>
      <div className="mt-7">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-[-0.025em]">{question.prompt}</h1>
        {apiCapabilities.voice && (
          <div className={styles.recorder}>
            <button
              ref={microphoneRef}
              type="button"
              className={styles.microphone}
              data-recording={recordingState === "recording"}
              disabled={recordingState === "starting" || recordingState === "stopping"}
              aria-label={recordingState === "recording" ? "Stop recording" : recordingActive ? recordingLabel : "Answer by voice"}
              aria-describedby="answer-recording-status"
              onClick={() => recordingState === "recording" ? stopRecording() : void startRecording()}
            >
              {recordingState === "starting" || recordingState === "stopping"
                ? <LoaderCircle className={styles.spinner} aria-hidden="true" />
                : recordingState === "recording"
                  ? <Square className={styles.stopIcon} aria-hidden="true" />
                  : <Mic aria-hidden="true" />}
            </button>
            <div className={recordingActive ? styles.feedback : "sr-only"}>
              <p id="answer-recording-status" role="status">{recordingLabel}</p>
              {recordingActive && (
                <Button variant="ghost" size="sm" onClick={cancelRecording} disabled={recordingState === "stopping"}><RotateCcw className="size-4" /> Cancel</Button>
              )}
            </div>
            {!recordingActive && <p className={styles.voiceHint}>Tap once and speak naturally</p>}
          </div>
        )}
        <div className={styles.answerArea}>
          {showVoiceInvitation && (
            <div className={styles.voiceInvitation}>
              <h2 className="text-lg font-bold">Tell us in your own words</h2>
              <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
                {recordingActive
                  ? recordingState === "recording"
                    ? "Start speaking. Your words will appear here as you talk."
                    : recordingLabel
                  : "Tap the microphone to record your answer. You can review and edit the text before submitting."}
              </p>
              <button
                type="button"
                className={`${styles.microphone} ${styles.invitationMicrophone}`}
                disabled={recordingActive}
                aria-label="Answer by voice"
                aria-describedby="answer-recording-status"
                onClick={() => void startRecording()}
              >
                <Mic aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.typeInstead}
                disabled={recordingState === "starting" || recordingState === "stopping"}
                onClick={() => {
                  if (recordingActive) cancelRecording();
                  setInputRevealed(true);
                  window.requestAnimationFrame(() => answerInputRef.current?.focus());
                }}
              >
                I prefer to type
              </button>
            </div>
          )}
          <Textarea
            ref={answerInputRef}
            aria-label="Your answer"
            rows={5}
            value={answer}
            disabled={recordingActive || showVoiceInvitation}
            onChange={(event) => {
              setAnswers((current) => ({ ...current, [question.questionId]: event.target.value }));
              setSaveState("idle");
            }}
            placeholder={recordingActive ? "Your words will appear here as you speak." : "Write what comes to mind. You can edit this before submitting."}
            className={`${styles.answerInput} min-h-36 text-base leading-7 ${showVoiceInvitation ? "invisible" : ""}`}
          />
        </div>
        <p className="mt-4 min-h-5 text-sm text-red-700" role="alert">{error}</p>
      </div>
      <p className="mt-5 text-center text-xs leading-5 text-[var(--muted)]">Only the text you approve on the review screen will be submitted.</p>
      <div className={`${styles.navigation} mt-5`} data-voice={apiCapabilities.voice}>
        <div className="mx-auto flex max-w-3xl justify-between gap-3">
          <Button variant="ghost" onClick={previous} disabled={index === 0 || recordingActive}><ArrowLeft className="size-4" /> Previous</Button>
          <Button variant="accent" onClick={next} disabled={!canContinue || recordingActive}>{index === survey.questions.length - 1 ? "Review answers" : "Next question"}<ArrowRight className="size-4" /></Button>
        </div>
      </div>
    </ParticipantShell>
  );
}
