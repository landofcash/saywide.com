"use client";

import type { PublicSurvey } from "@saywide/contracts";
import { ArrowRight, Check, Clock3, Keyboard, Mic, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { api, apiCapabilities } from "@/lib/api";
import { hasSubmittedFromBrowser, saveParticipantSession } from "@/lib/participant-state";

export function WelcomeScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [error, setError] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRepeat(hasSubmittedFromBrowser(publicToken)), 0);
    void api.getPublicSurvey(publicToken).then(setSurvey).catch((reason: Error) => setError(reason.message));
    return () => window.clearTimeout(timer);
  }, [publicToken]);

  async function start() {
    setStarting(true);
    setError("");
    try {
      const session = await api.startResponse(publicToken, {
        consentVersion: survey!.consentVersion,
        accessCode: accessCode || undefined,
      });
      saveParticipantSession(publicToken, session.sessionId);
      router.push(`/s/${publicToken}/respond`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This survey could not be started.");
      setStarting(false);
    }
  }

  if (!survey && !error) return <ParticipantShell><div className="h-[32rem] animate-pulse rounded-xl bg-[var(--canvas)]" /></ParticipantShell>;

  if (error || repeat || survey?.status !== "open") {
    const title = repeat ? "It looks like you already responded" : survey?.status === "closed" ? "This survey is closed" : "This survey is unavailable";
    const description = repeat ? "This browser has a completed-response marker for this survey. This is a browser-based limit, not identity verification." : survey?.status === "closed" ? "The organizer is no longer accepting responses. Nothing you type here will be collected." : "The link may be invalid, expired, or temporarily unavailable. Check the link and try again.";
    return <ParticipantShell><Card className="mx-auto mt-12 max-w-xl p-7 text-center sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-lg border border-amber-200 bg-amber-50"><TriangleAlert className="size-6 text-amber-800" /></span><h1 className="font-display mt-5 text-3xl font-bold tracking-[-0.025em]">{title}</h1><p className="mt-4 leading-7 text-[var(--muted)]">{description}</p>{!repeat && !survey && <Button className="mt-7" onClick={() => window.location.reload()}>Try again</Button>}</Card></ParticipantShell>;
  }

  return (
    <ParticipantShell>
      <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">You’re invited to take part in a survey</p><h1 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{survey.title}</h1><p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">{survey.introduction}</p></div>
      <Card className="mt-6 p-5 sm:p-7">
        <div className="flex flex-wrap justify-center gap-3">
          <div className="w-36 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--coral-dark)]"><Clock3 className="size-4" /> Time {survey.estimatedMinutes}′</p>
          </div>
          <div className="w-36 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--coral-dark)]"><Check className="size-4" /> Questions {survey.questions.length}</p>
          </div>
        </div>
        {survey.requiresAccessCode && <div className="mt-6"><Label htmlFor="access-code">Access code</Label><Input id="access-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="one-time-code" /></div>}
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">By starting, you agree to submit your reviewed text for this survey&apos;s stated purpose.</p>
        <Button variant="accent" size="lg" className="mt-5 w-full" onClick={start} disabled={starting || (survey.requiresAccessCode && !accessCode)}>{starting ? "Starting…" : <>Start survey <ArrowRight className="size-5" /></>}</Button>
        <div className="mt-7 space-y-4 border-t border-[var(--line)] pt-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Privacy and response options</p><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div><p className="font-bold">No name, email, or account</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Your words are combined with other responses. Short excerpts may appear as anonymous evidence.</p></div></div>{apiCapabilities.voice && <div className="flex gap-3"><Mic className="mt-0.5 size-5 shrink-0 text-[var(--coral-dark)]" /><div><p className="font-bold">Speak or type every answer</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Voice is transcribed immediately and audio is not retained. You review all text before submitting.</p></div></div>}<div className="flex gap-3"><Keyboard className="mt-0.5 size-5 shrink-0 text-slate-600" /><div><p className="font-bold">Type every answer</p><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Your draft stays editable until you submit it.</p></div></div></div>
      </Card>
    </ParticipantShell>
  );
}
