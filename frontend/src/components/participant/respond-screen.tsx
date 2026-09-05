"use client";

import type { ParticipantAnswers, PublicSurvey } from "@saywide/contracts";
import { ArrowLeft, ArrowRight, AudioLines, Keyboard, Mic, RotateCcw, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form-controls";
import { api } from "@/lib/api";

const demoTranscript = "I appreciated having clear ownership, but the handoffs after meetings often left me unsure about the next step.";

export function RespondScreen({ publicToken, initialQuestion = 1 }: { publicToken: string; initialQuestion?: number }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<ParticipantAnswers>({});
  const [index, setIndex] = useState(Math.max(0, initialQuestion - 1));
  const [recording, setRecording] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "idle">("idle");

  useEffect(() => { void Promise.all([api.getPublicSurvey(publicToken), api.readAnswers(publicToken)]).then(([surveyItem, answerItems]) => { setSurvey(surveyItem); setAnswers(answerItems); setIndex((current) => Math.min(current, surveyItem.questions.length - 1)); }); }, [publicToken]);

  if (!survey) return <ParticipantShell><div className="h-[34rem] animate-pulse rounded-[2rem] bg-[var(--canvas)]" /></ParticipantShell>;
  const question = survey.questions[index];
  const answer = answers[question.questionId] ?? "";
  const canContinue = !question.required || answer.trim().length > 0;

  async function persist(value = answer) {
    setSaveState("saving");
    await api.saveAnswer(publicToken, question.questionId, value);
    setSaveState("saved");
  }

  async function next() {
    if (!canContinue) return;
    await persist();
    if (index === survey!.questions.length - 1) router.push(`/s/${publicToken}/review`);
    else { setIndex((current) => current + 1); setSaveState("idle"); setRecording(false); }
  }

  async function previous() {
    await persist();
    setIndex((current) => Math.max(0, current - 1));
    setSaveState("idle");
  }

  function stopRecording() {
    setRecording(false);
    const nextAnswer = answer ? `${answer}\n${demoTranscript}` : demoTranscript;
    setAnswers((current) => ({ ...current, [question.questionId]: nextAnswer }));
    setSaveState("idle");
  }

  return (
    <ParticipantShell>
      <div className="flex items-center justify-between gap-4"><p className="text-sm font-bold">Question {index + 1} of {survey.questions.length}</p><p className="text-xs font-semibold text-[var(--muted)]" aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved on this device" : "Draft stays on this device"}</p></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--canvas)]" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={survey.questions.length}><div className="h-full rounded-full bg-[var(--coral)] transition-all" style={{ width: `${((index + 1) / survey.questions.length) * 100}%` }} /></div>
      <Card className="mt-7 p-5 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral-dark)]">{question.required ? "Answer required" : "Optional"}</p><h1 className="font-display mt-3 text-4xl font-bold leading-tight tracking-[-0.04em]">{question.prompt}</h1></div><span className="hidden size-12 shrink-0 place-items-center rounded-full bg-[var(--mint-soft)] sm:grid">{index + 1}</span></div>
        <Textarea aria-label="Your answer" rows={9} value={answer} onChange={(event) => { setAnswers((current) => ({ ...current, [question.questionId]: event.target.value })); setSaveState("idle"); }} placeholder="Write what comes to mind. You can edit this before submitting." className="mt-7 min-h-56 text-base leading-7" />
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[var(--canvas)] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-full ${recording ? "bg-[var(--coral)]" : "bg-white"}`}>{recording ? <AudioLines className="size-5 animate-pulse" /> : <Keyboard className="size-5" />}</span><div><p className="text-sm font-bold">{recording ? "Listening…" : "Prefer to speak?"}</p><p className="text-xs text-[var(--muted)]">{recording ? "Your draft stays editable." : "Audio is transcribed, not stored."}</p></div></div>{recording ? <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setRecording(false)}><RotateCcw className="size-4" /> Cancel</Button><Button variant="accent" size="sm" onClick={stopRecording}><Square className="size-3 fill-current" /> Stop</Button></div> : <Button variant="secondary" size="sm" onClick={() => setRecording(true)}><Mic className="size-4" /> Answer by voice</Button>}</div>
        <p className="mt-4 min-h-5 text-sm text-red-700" role="alert">{!canContinue && answer.length === 0 ? "" : ""}</p>
        <div className="mt-2 flex justify-between gap-3"><Button variant="ghost" onClick={previous} disabled={index === 0}><ArrowLeft className="size-4" /> Previous</Button><Button variant="accent" onClick={next} disabled={!canContinue}>{index === survey.questions.length - 1 ? "Review answers" : "Next question"}<ArrowRight className="size-4" /></Button></div>
      </Card>
      <p className="mt-5 text-center text-xs leading-5 text-[var(--muted)]">Only the text you approve on the review screen will be submitted.</p>
    </ParticipantShell>
  );
}
