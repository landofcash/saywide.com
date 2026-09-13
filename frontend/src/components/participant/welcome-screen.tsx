"use client";

import type { PublicSurvey } from "@saywide/contracts";
import { ArrowRight, Check, ChevronDown, Clock3, Keyboard, LoaderCircle, Mic, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import styles from "@/components/participant/welcome-screen.module.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form-controls";
import { api, apiCapabilities } from "@/lib/api";
import { hasSubmittedFromBrowser, saveParticipantSession } from "@/lib/participant-state";

function initializeDisclosure(node: HTMLDetailsElement | null) {
  // Set the initial layout once; subsequent renders preserve the participant's choice.
  if (node) node.open = window.matchMedia("(min-width: 640px)").matches;
}

function ResponseOption({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <details ref={initializeDisclosure} className={styles.option}>
      <summary className={styles.optionSummary}>
        <span className={styles.optionIcon}><Icon size={19} aria-hidden="true" /></span>
        <span>{title}</span>
        <ChevronDown size={17} className={styles.chevron} aria-hidden="true" />
      </summary>
      <p className={styles.optionDescription}>{children}</p>
    </details>
  );
}

export function WelcomeScreen({ publicToken }: { publicToken: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [error, setError] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [pressed, setPressed] = useState(false);

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

    return <ParticipantShell><Card className="mx-auto mt-12 max-w-xl p-7 text-center sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-lg border border-amber-200 bg-amber-50"><TriangleAlert className="size-6 text-amber-800" /></span><h1 className="font-display mt-5 text-3xl font-bold tracking-[-0.025em]">{title}</h1>{!repeat && !survey && <Button className="mt-7" onClick={() => window.location.reload()}>Try again</Button>}</Card></ParticipantShell>;
  }

  return (
    <ParticipantShell>
      <div className={styles.welcome}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>You’re invited to take part in a survey</p>
          <h1 className={styles.title}>{survey.title}</h1>
          <p className={styles.description}>{survey.introduction}</p>
          <div className={styles.metadata}>
            <span><Clock3 size={16} aria-hidden="true" /> About {survey.estimatedMinutes} min</span>
            <span className={styles.metadataDot} aria-hidden="true" />
            <span><Check size={16} aria-hidden="true" /> {survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}</span>
          </div>
        </header>

        <div className={styles.action}>
          {survey.requiresAccessCode && <div className={styles.accessCode}><Label htmlFor="access-code">Access code</Label><Input id="access-code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoComplete="one-time-code" /></div>}
          <Button variant="accent" size="lg" className={styles.startButton} onClick={start} disabled={starting || (survey.requiresAccessCode && !accessCode)} aria-busy={starting}
            data-pressed={pressed}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setPressed(true);
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onLostPointerCapture={() => setPressed(false)}
          >
            <span className={styles.shimmerTrack} aria-hidden="true"><span className={styles.shimmerSlide}><span className={styles.shimmerSpark} /></span></span>
            <span className={styles.shimmerBackdrop} aria-hidden="true" />
            <span>{starting ? "Starting…" : "Start survey"}</span>
            <span className={styles.buttonIcon}>{starting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-5" aria-hidden="true" />}</span>
          </Button>
          <p className={styles.consent}>By starting, you agree to share your answers for the purpose stated above.</p>
        </div>

        <section className={styles.options} aria-labelledby="response-options-title">
          <h2 id="response-options-title" className={styles.optionsTitle}>Privacy and response options</h2>
          <ResponseOption icon={ShieldCheck} title="No name, email, or account">Your words are combined with other responses. Short excerpts may appear as anonymous evidence.</ResponseOption>
          {apiCapabilities.voice && <ResponseOption icon={Mic} title="Speak or type every answer">Voice is transcribed immediately and audio is not retained. You review all text before submitting.</ResponseOption>}
          <ResponseOption icon={Keyboard} title="Type every answer">Your draft stays editable until you submit it.</ResponseOption>
        </section>
      </div>
    </ParticipantShell>
  );
}
