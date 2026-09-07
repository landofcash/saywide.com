"use client";

import type { ParticipantAnswers, PublicSurvey } from "@saywide/contracts";
import { ArrowLeft, CheckCircle2, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

export function ReviewScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [answers, setAnswers] = useState<ParticipantAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void Promise.all([api.getPublicSurvey(publicToken), api.readAnswers(publicToken)]).then(([surveyItem, answerItems]) => { setSurvey(surveyItem); setAnswers(answerItems); }); }, [publicToken]);
  if (!survey) return <ParticipantShell><div className="h-[34rem] animate-pulse rounded-xl bg-[var(--canvas)]" /></ParticipantShell>;
  const missing = survey.questions.filter((question) => question.required && !answers[question.questionId]?.trim());

  async function submit() {
    if (missing.length > 0) { setError("Please answer every required question before submitting."); return; }
    setSubmitting(true);
    setError("");
    try {
      const result = await api.submitResponse(publicToken);
      window.sessionStorage.setItem(`saywide.completed.${publicToken}`, result.submittedAt);
      router.replace(`/s/${publicToken}/complete`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your response could not be submitted. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <ParticipantShell>
      <Link href={`/s/${publicToken}/respond`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft className="size-4" /> Back to answers</Link>
      <div className="mt-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Final check</p><h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">Review your words</h1><p className="mt-4 text-lg leading-8 text-[var(--muted)]">This is exactly the text that will be stored. You can go back and change anything before submitting.</p></div>
      <div className="mt-7 space-y-4">{survey.questions.map((question, index) => <Card key={question.questionId} className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Question {index + 1}</p><h2 className="mt-2 font-bold leading-6">{question.prompt}</h2></div><Button variant="ghost" size="sm" asChild><Link href={`/s/${publicToken}/respond?question=${index + 1}`}><Pencil className="size-4" /> Edit</Link></Button></div><p className={`mt-4 whitespace-pre-line rounded-lg border border-[var(--line)] p-4 text-sm leading-7 ${answers[question.questionId] ? "bg-[var(--canvas)]" : "bg-red-50 text-red-800"}`}>{answers[question.questionId] || (question.required ? "Required answer missing" : "No answer")}</p></Card>)}</div>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <Card className="mt-6 border-l-4 border-l-emerald-700 bg-white p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-800" /><p className="text-sm leading-6 text-emerald-950/80">I understand my reviewed text will be submitted anonymously and may appear as a short, pseudonymous evidence excerpt in the organizer&apos;s report.</p></div></Card>
      <Button variant="accent" size="lg" className="mt-6 w-full" disabled={submitting || missing.length > 0} onClick={submit}>{submitting ? "Submitting safely…" : <><Send className="size-5" /> Submit response</>}</Button>
    </ParticipantShell>
  );
}
