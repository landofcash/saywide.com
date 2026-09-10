"use client";

import type { SurveyDetail } from "@saywide/contracts";
import { ArrowLeft, ArrowRight, CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { SurveyWritingControls } from "@/components/organizer/survey-writing-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/form-controls";
import { api } from "@/lib/api";
import { formatDateTime, pluralize } from "@/lib/utils";

const examples = [
  { label: "Overall picture", title: "Give me the overall picture", description: "Summarize the main ideas and different perspectives." },
  { label: "Common themes", title: "Show what came up most often", description: "Find the most frequently mentioned themes, concerns, and suggestions." },
  { label: "Next steps", title: "Suggest practical next steps", description: "Turn the responses into useful recommendations." },
];

const presetInstruction = (example: typeof examples[number]) => `${example.title}. ${example.description}`;

export function CreateReportScreen({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [instruction, setInstruction] = useState("");
  const [creating, setCreating] = useState(false);
  const [writingBusy, setWritingBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void api.getSurvey(surveyId).then(setSurvey); }, [surveyId]);

  async function create() {
    if (!survey || instruction.trim().length < 12 || writingBusy || creating) return;
    setCreating(true);
    setError("");
    try {
      const report = await api.createReport(surveyId, instruction.trim());
      router.push(`/reports/${report.reportId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be started. Your instruction is still here—please try again.");
      setCreating(false);
    }
  }

  if (!survey) return <OrganizerShell><div className="h-96 animate-pulse rounded-xl bg-white" /></OrganizerShell>;
  const eligible = survey.submittedResponseCount;
  const allowed = eligible >= survey.settings.minReportResponses;

  return (
    <OrganizerShell>
      <Link href={`/surveys/${surveyId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft className="size-4" /> Survey overview</Link>
      <div className="mx-auto mt-5 max-w-4xl">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Turn responses into insights</p><h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">What would you like to understand?</h1><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">Say what you want to explore, or choose a suggestion to get started. Saywide will find the patterns, show what people said, and create your report.</p></div>
        <Card className="mt-8 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)] pb-5 text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">Report for: {survey.title}</span>
            <span>{pluralize(eligible, "submitted response")}</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900"><ShieldCheck className="size-4" /> Minimum {survey.settings.minReportResponses} responses</div>
          </div>
          <section className="mt-7" aria-labelledby="suggested-reports-heading">
            <h2 id="suggested-reports-heading" className="text-xs font-semibold text-[var(--muted)]">Suggestions</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example.title} type="button" disabled={writingBusy || creating} onClick={() => setInstruction(presetInstruction(example))} aria-pressed={instruction === presetInstruction(example)} className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral)] aria-pressed:border-[var(--coral)] aria-pressed:bg-[var(--mint-soft)] aria-pressed:text-[var(--coral-dark)]">
                {example.label}
              </button>
            ))}
          </div>
          </section>
          <section className="mt-8 border-t border-[var(--line)] pt-7" aria-labelledby="custom-report-heading">
            <h2 id="custom-report-heading" className="text-xl font-bold">Or create your own</h2>
            <Label htmlFor="report-instruction" className="mt-2 text-sm font-normal text-[var(--muted)]">Tell Saywide what to look for.</Label>
            <Textarea id="report-instruction" rows={7} maxLength={2000} readOnly={writingBusy || creating} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={"Find unexpected insights,\ncompare positive and negative feedback,\nsummarize each question."} className="mt-4 text-base leading-7" />
            <SurveyWritingControls field="report-instruction" value={instruction} disabled={writingBusy || creating} onBusyChange={setWritingBusy} onChange={setInstruction} />
          </section>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[["1", "Freeze the response snapshot"], ["2", "Find and count patterns"], ["3", "Validate every finding"]].map(([number, label]) => <div key={number} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3 text-sm font-semibold"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-xs">{number}</span>{label}</div>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-[var(--muted)]">The snapshot is fixed when you start. New responses can be included in a later report. Current time: {formatDateTime(new Date().toISOString())}.</p>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!allowed && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Collect {survey.settings.minReportResponses - eligible} more responses before creating a report.</p>}
          <Button variant="accent" size="lg" className="mt-7 w-full" disabled={!allowed || instruction.trim().length < 12 || creating || writingBusy} onClick={create}>{creating ? <><FileSearch className="size-5 animate-pulse" /> Freezing snapshot…</> : <><CheckCircle2 className="size-5" /> Generate report <ArrowRight className="size-5" /></>}</Button>
        </Card>
      </div>
    </OrganizerShell>
  );
}
