"use client";

import type { Finding, Report } from "@saywide/contracts";
import { ArrowLeft, Check, ChevronDown, Download, FilePlus2, Quote, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime, pluralize } from "@/lib/utils";

const progressSteps = ["Preparing response snapshot", "Finding themes", "Checking evidence", "Writing report"];

export function ReportScreen({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let interval: number | undefined;
    void api.getReport(reportId).then((item) => {
      if (!active) return;
      setReport(item);
      let current = 0;
      interval = window.setInterval(() => {
        current += 1;
        setStep(current);
        if (current >= progressSteps.length) {
          window.clearInterval(interval);
          setReady(true);
        }
      }, 240);
    });
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };
  }, [reportId]);

  function downloadMarkdown() {
    if (!report) return;
    const findings = report.findings.map((finding) => `## ${finding.title}\n\n${finding.summary}\n\n- Support: ${finding.supportCount}/${report.eligibleResponseCount} (${finding.supportPercentage}%)\n- Confidence: ${finding.confidence}\n- Suggested action: ${finding.suggestedAction}`).join("\n\n");
    const content = `# ${report.surveyTitle}\n\n${report.instruction}\n\n${findings}\n\n## Limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "saywide-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!report || !ready) {
    return (
      <OrganizerShell>
        <div className="mx-auto max-w-2xl pt-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--lavender)]"><Sparkles className="size-7 animate-pulse" /></span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Building your report</p>
          <h1 className="font-display mt-3 text-5xl font-bold tracking-[-0.05em]">Following the evidence</h1>
          <div className="mx-auto mt-8 max-w-md space-y-3 text-left" aria-live="polite">{progressSteps.map((label, index) => <div key={label} className={`flex items-center gap-3 rounded-2xl border p-4 ${index < step ? "border-emerald-200 bg-[var(--mint-soft)]" : index === step ? "border-[var(--ink)] bg-white" : "border-[var(--line)] bg-white/40 text-[var(--muted)]"}`}><span className={`grid size-7 place-items-center rounded-full ${index < step ? "bg-emerald-700 text-white" : "bg-[var(--canvas)]"}`}>{index < step ? <Check className="size-4" /> : index + 1}</span><span className="text-sm font-semibold">{label}</span></div>)}</div>
        </div>
      </OrganizerShell>
    );
  }

  return (
    <OrganizerShell wide>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-4xl"><Link href={`/surveys/${report.surveyId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft className="size-4" /> Survey overview</Link><div className="mt-4 flex gap-2"><Badge tone="open">Validated</Badge><Badge>{pluralize(report.eligibleResponseCount, "response")}</Badge></div><h1 className="font-display mt-4 text-5xl font-bold tracking-[-0.055em] sm:text-6xl">What the responses are telling you</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">{report.instruction}</p><p className="mt-2 text-xs text-[var(--muted)]">Frozen {formatDateTime(report.snapshotAt)}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={downloadMarkdown}><Download className="size-4" /> Markdown</Button><Button variant="accent" asChild><Link href={`/surveys/${report.surveyId}/reports/new`}><FilePlus2 className="size-4" /> Another report</Link></Button></div>
      </div>

      <div className="mt-9 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">{report.findings.map((finding, index) => <FindingCard finding={finding} index={index} denominator={report.eligibleResponseCount} key={finding.findingId} />)}</div>
        <aside className="space-y-5">
          <Card className="p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Minority views</p><div className="mt-4 space-y-3">{report.minorityViews.map((item) => <p key={item} className="rounded-2xl bg-violet-50 p-4 text-sm leading-6">{item}</p>)}</div></Card>
          <Card className="p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Ask next</p><ol className="mt-4 space-y-4">{report.followUpQuestions.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="font-display text-xl font-bold text-[var(--coral-dark)]">{index + 1}.</span>{item}</li>)}</ol></Card>
          <Card className="border-amber-200 bg-amber-50 p-6"><p className="font-bold">Read with context</p><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-amber-950/75">{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></Card>
        </aside>
      </div>
    </OrganizerShell>
  );
}

function FindingCard({ finding, index, denominator }: { finding: Finding; index: number; denominator: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid sm:grid-cols-[150px_1fr]">
        <div className={`p-6 ${finding.category === "strength" ? "bg-[var(--mint-soft)]" : finding.category === "friction" ? "bg-orange-50" : "bg-violet-50"}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Finding {index + 1}</p><p className="font-display mt-3 text-5xl font-bold">{finding.supportPercentage}%</p><p className="mt-1 text-xs text-[var(--muted)]">{finding.supportCount} of {denominator} responses</p><Badge className="mt-4">{finding.confidence} confidence</Badge></div>
        <div className="p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral-dark)]">{finding.category.replace("-", " ")}</p><h2 className="font-display mt-2 text-3xl font-bold tracking-[-0.035em]">{finding.title}</h2><p className="mt-3 leading-7 text-[var(--muted)]">{finding.summary}</p><div className="mt-5 rounded-2xl bg-[var(--canvas)] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Suggested action</p><p className="mt-2 text-sm font-semibold leading-6">{finding.suggestedAction}</p></div><details className="group mt-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-[var(--line)] px-4 text-sm font-semibold">View supporting evidence <ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="mt-3 space-y-3">{finding.evidence.map((evidence) => <blockquote key={`${evidence.label}-${evidence.excerpt}`} className="rounded-2xl border-l-4 border-[var(--mint)] bg-white p-4"><Quote className="size-4 text-[var(--muted)]" /><p className="mt-2 text-sm leading-6">“{evidence.excerpt}”</p><footer className="mt-2 text-xs font-bold text-[var(--muted)]">{evidence.label}</footer></blockquote>)}</div></details></div>
      </div>
    </Card>
  );
}
