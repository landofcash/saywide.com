"use client";

import { ArrowRight, AudioLines, Check, Mic, PenLine, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form-controls";
import { api } from "@/lib/api";

const example = "I want to understand what helped our remote team work well this quarter and where our process got in the way.";

export function CreateSurveyScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [recording, setRecording] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createSurvey() {
    if (goal.trim().length < 12) return;
    setCreating(true);
    setError("");
    try {
      const survey = await api.draftSurveyFromGoal(goal.trim());
      router.push(`/surveys/${survey.surveyId}/edit`);
    } catch {
      setError("We could not create the draft just now. Your description is still here—please try again.");
      setCreating(false);
    }
  }

  function toggleRecording() {
    if (!recording) {
      setRecording(true);
      return;
    }
    setRecording(false);
    if (!goal) setGoal(example);
  }

  return (
    <div className="noise min-h-screen overflow-hidden">
      <header className="mx-auto flex h-24 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Button variant="ghost" asChild><Link href="/dashboard">My surveys</Link></Button>
          <Button variant="secondary" size="sm" asChild><Link href="/login">Sign in</Link></Button>
        </nav>
      </header>
      <main className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-14">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-900">
            <Sparkles className="size-3.5" /> Ask openly. Understand clearly.
          </div>
          <h1 className="font-display max-w-[10ch] text-[clamp(3.4rem,8vw,7.4rem)] font-bold leading-[0.88] tracking-[-0.065em]">
            Hear what everyone has to say.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Create an open-ended survey, collect answers by voice or text, and turn them into a report grounded in real evidence.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[var(--muted)]">
            {['No sign-up to start', 'Anonymous responses', 'Evidence with every finding'].map((item) => (
              <span key={item} className="flex items-center gap-2"><Check className="size-4 text-emerald-700" /> {item}</span>
            ))}
          </div>
        </section>

        <Card className="relative overflow-hidden p-5 sm:p-8">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[var(--yellow)]/45" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Start with your goal</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-[-0.035em]">What do you want to learn?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Describe the audience and the decision their perspective will help you make.</p>
            <div className="relative mt-6">
              <Textarea
                aria-label="Survey goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={8}
                placeholder={example}
                className="min-h-48 pr-5 text-base leading-7"
              />
              <div className="absolute bottom-4 right-4">
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? "accent" : "secondary"}
                  onClick={toggleRecording}
                  aria-label={recording ? "Stop recording" : "Describe by voice"}
                >
                  {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
                </Button>
              </div>
            </div>
            <div className="mt-3 min-h-6 text-xs text-[var(--muted)]" aria-live="polite">
              {recording ? <span className="flex items-center gap-2 font-semibold text-[var(--coral-dark)]"><AudioLines className="size-4 animate-pulse" /> Listening… press stop when you are done.</span> : "Voice is transcribed as you speak. Audio is not retained."}
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" variant="accent" className="flex-1" onClick={createSurvey} disabled={goal.trim().length < 12 || creating}>
                {creating ? "Drafting your survey…" : "Create my survey"} {!creating && <ArrowRight className="size-5" />}
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/surveys/new"><PenLine className="size-4" /> Start manually</Link>
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
