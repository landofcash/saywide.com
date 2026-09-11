"use client";

import { ArrowRight, AudioLines, LayoutDashboard, LogIn, Menu, Mic, PenLine, Sparkles, Square, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form-controls";
import { api, apiCapabilities } from "@/lib/api";

const example = "I want to understand what helped our remote team work well this quarter and where our process got in the way.";

export function CreateSurveyScreen() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [recording, setRecording] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen overflow-hidden">
      <header className="relative border-b border-[var(--line)] bg-white sm:border-b-0 sm:bg-transparent">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex" aria-label="Organizer navigation">
            <Button variant="ghost" asChild><Link href="/dashboard">My surveys</Link></Button>
            {apiCapabilities.accounts && <Button variant="secondary" size="sm" asChild><Link href="/login">Sign in</Link></Button>}
          </nav>
          <Button type="button" variant="ghost" size="icon" className="sm:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-home-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-home-navigation" className="absolute inset-x-0 top-full z-30 border-b border-[var(--line)] bg-white shadow-lg sm:hidden" aria-label="Mobile organizer navigation">
            <div className="px-4 py-2">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-[var(--line)] px-2 text-sm font-semibold"><LayoutDashboard className="size-5 text-[var(--coral-dark)]" /> My surveys</Link>
              {apiCapabilities.accounts && <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="flex min-h-12 items-center gap-3 px-2 text-sm font-semibold"><LogIn className="size-5 text-[var(--coral-dark)]" /> Sign in</Link>}
            </div>
          </nav>
        )}
      </header>
      <main className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-6 sm:gap-10 sm:px-8 sm:pb-20 sm:pt-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:pt-12">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-[var(--mint-soft)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-900">
            <Sparkles className="size-3.5" /> Ask openly. Understand clearly.
          </div>
          <h1 className="font-display max-w-[13ch] text-[clamp(2.25rem,4vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.035em]">
            Hear what everyone has to say
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Create a survey simply by speaking your questions, and let AI refine them when needed. Participants answer freely by voice, and Saywide transforms every response into useful insights.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[var(--muted)]">
            {[
              { icon: Mic, label: "Voice-first surveys" },
              { icon: UserRoundCheck, label: "No sign-up required" },
              { icon: Sparkles, label: "AI-generated insights" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2"><Icon className="size-4 shrink-0" aria-hidden="true" /> {label}</span>
            ))}
          </div>
        </section>

        {apiCapabilities.goalDrafting ? <Card className="p-5 sm:p-8"><div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Start with your goal</p>
            <h2 className="font-display mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">What do you want to learn?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Describe the audience and the decision their perspective will help you make.</p>
            <div className="relative mt-6">
              <Textarea
                aria-label="Survey goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                rows={8}
                placeholder={example}
                className="min-h-40 pr-5 text-base leading-7 sm:min-h-48"
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
          </div></Card> : <div>
            <Button size="lg" variant="accent" className="mt-8 w-full" asChild>
              <Link href="/surveys/new"><PenLine className="size-4" /> Build a survey</Link>
            </Button>
          </div>}
      </main>
    </div>
  );
}
