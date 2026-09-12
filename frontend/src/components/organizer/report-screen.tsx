"use client";

import type { Finding, Report, ReportActivity } from "@saywide/contracts";
import { ArrowLeft, ChevronDown, Download, FilePlus2, Quote, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { ReportProgress } from "@/components/organizer/report-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { createReportPresentation, finishReportPresentation, hasPendingReportPresentation, rememberReportPresentation, reportStages } from "@/lib/report-presentation";
import { formatDateTime, pluralize } from "@/lib/utils";

import styles from "./report-progress.module.css";

export function ReportScreen({ reportId }: { reportId: string }) {
  return <ReportView key={reportId} reportId={reportId} />;
}

function ReportView({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<ReportActivity[]>([]);
  const [surveyId, setSurveyId] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let timeout: number | undefined;
    let needsPresentation = hasPendingReportPresentation(reportId);
    let completedReport: Report | undefined;
    const presentation = createReportPresentation((nextStep) => {
      if (!active) return;
      setStep(nextStep);
      if (nextStep > reportStages.length && completedReport) {
        finishReportPresentation(reportId);
        setReport(completedReport);
      }
    });

    async function refresh() {
      try {
        const result = await api.getReport(reportId);
        if (!active) return;
        setError("");
        setActivity(result.activity ?? []);
        setSurveyId(result.surveyId);
        if (result.status === "completed") {
          completedReport = result.report;
          setSurveyId(result.report.surveyId);
          if (needsPresentation) {
            presentation.update(reportStages.length);
          } else {
            // An existing report opens normally; newly created and observed running
            // reports always finish their presentation, even after a page reload.
            presentation.dispose();
            setReport(result.report);
          }
          return;
        }
        if (result.status === "failed") {
          presentation.dispose();
          finishReportPresentation(reportId);
          setFailed(true);
          setError("The report could not be completed. Your responses are safe; start another report to retry.");
          return;
        }
        needsPresentation = true;
        rememberReportPresentation(reportId);
        const progressIndex = reportStages.findIndex((stage) => stage.progress === result.progress);
        presentation.update(Math.max(0, progressIndex));
        timeout = window.setTimeout(refresh, 1000);
      } catch {
        if (!active) return;
        presentation.dispose();
        setError("The report status could not be loaded. Please refresh this page.");
      }
    }

    void refresh();
    return () => { active = false; presentation.dispose(); if (timeout) window.clearTimeout(timeout); };
  }, [reportId, refreshKey]);

  function downloadMarkdown() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "saywide-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!report) {
    return (
      <OrganizerShell>
        <div className="mx-auto max-w-5xl text-center">
          {error ? <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-white px-6 py-12">
            <CircleAlert className="mx-auto size-9 text-[var(--muted)]" aria-hidden="true" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">{failed ? "Report stopped" : "Status unavailable"}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em]">Your responses are safe</h1>
            <p role="alert" className="mt-4 text-sm leading-7 text-[var(--muted)]">{error}</p>
          </div> : <ReportProgress step={step} />}
          <ActivityTimeline activity={activity} />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {error && !failed && <Button onClick={() => { setStep(0); setError(""); setRefreshKey((key) => key + 1); }}>Retry status check</Button>}
            {failed && surveyId && <Button asChild><Link href={`/surveys/${surveyId}/reports/new`}>Start another report</Link></Button>}
            {error && <Button asChild variant="secondary"><Link href={surveyId ? `/surveys/${surveyId}` : "/dashboard"}>{surveyId ? "Back to survey" : "Back to surveys"}</Link></Button>}
          </div>
        </div>
      </OrganizerShell>
    );
  }

  return (
    <OrganizerShell wide>
      <div className={styles.resultReveal}>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-4xl"><Link href={`/surveys/${report.surveyId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)]"><ArrowLeft className="size-4" /> Survey overview</Link><div className="mt-4 flex gap-2"><Badge tone="open">Validated</Badge><Badge>{pluralize(report.eligibleResponseCount, "response")}</Badge></div><h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">What the responses are telling you</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">{report.instruction}</p><p className="mt-2 text-xs text-[var(--muted)]">Frozen {formatDateTime(report.snapshotAt)}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={downloadMarkdown}><Download className="size-4" /> Markdown</Button><Button variant="accent" asChild><Link href={`/surveys/${report.surveyId}/reports/new`}><FilePlus2 className="size-4" /> Another report</Link></Button></div>
      </div>

      <ActivityTimeline activity={activity} />
      <div className="mt-9 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">{report.findings.map((finding, index) => <FindingCard finding={finding} index={index} denominator={report.eligibleResponseCount} key={finding.findingId} />)}</div>
        <aside className="space-y-5">
          <Card className="p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Minority views</p><div className="mt-4 space-y-3">{report.minorityViews.map((item) => <p key={item} className="rounded-lg border-l-4 border-l-slate-500 bg-[var(--canvas)] p-4 text-sm leading-6">{item}</p>)}</div></Card>
          <Card className="p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Ask next</p><ol className="mt-4 space-y-4">{report.followUpQuestions.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="font-display text-xl font-bold text-[var(--coral-dark)]">{index + 1}.</span>{item}</li>)}</ol></Card>
          <Card className="border-amber-200 bg-amber-50 p-6"><p className="font-bold">Read with context</p><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-amber-950/75">{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></Card>
        </aside>
      </div>
      </div>
    </OrganizerShell>
  );
}

export function ActivityTimeline({ activity, expanded = false, preview = false }: { activity: ReportActivity[]; expanded?: boolean; preview?: boolean }) {
  if (!activity.length) return null;
  return <details open={expanded || undefined} className="mt-6 rounded-lg border border-[var(--line)] bg-white p-4 text-left">
    <summary className="cursor-pointer text-sm font-semibold">Agent activity · {activity.length} recent events</summary>
    <p className="mt-2 text-xs text-[var(--muted)]">{preview ? "Sample agent activity for this preview. Events appear as each stage is shown; times and durations are illustrative." : "Actual agent calls and application checks. No private response content is shown."}</p>
    <ol className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-label="Report activity">
      {activity.map((event) => <li key={event.sequence} className="border-l-2 border-[var(--line)] pl-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span>{event.label}</span><span className="text-xs text-[var(--muted)]">{event.durationMs === null ? "" : `${(event.durationMs / 1000).toFixed(1)}s`}</span></div>
        <div className="mt-1 text-xs text-[var(--muted)]">{event.source === "agent" ? "Strands agent" : "Application"} · <time dateTime={event.createdAt}>{preview ? new Date(event.createdAt).toLocaleTimeString("en-GB", { timeZone: "UTC" }) : new Date(event.createdAt).toLocaleTimeString()}</time></div>
      </li>)}
    </ol>
  </details>;
}

function FindingCard({ finding, index, denominator }: { finding: Finding; index: number; denominator: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid sm:grid-cols-[150px_1fr]">
        <div className={`border-l-4 bg-slate-50 p-6 ${finding.category === "strength" ? "border-l-emerald-700" : finding.category === "friction" ? "border-l-amber-700" : "border-l-slate-500"}`}><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Finding {index + 1}</p><p className="font-display mt-3 text-4xl font-bold">{finding.supportPercentage}%</p><p className="mt-1 text-xs text-[var(--muted)]">{finding.supportCount} of {denominator} responses</p><Badge className="mt-4">{finding.confidence} confidence</Badge></div>
        <div className="p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral-dark)]">{finding.category.replace("-", " ")}</p><h2 className="font-display mt-2 text-2xl font-bold tracking-[-0.025em]">{finding.title}</h2><p className="mt-3 leading-7 text-[var(--muted)]">{finding.summary}</p><div className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Suggested action</p><p className="mt-2 text-sm font-semibold leading-6">{finding.suggestedAction}</p></div><details className="group mt-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-[var(--line)] px-4 text-sm font-semibold">View supporting evidence <ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="mt-3 space-y-3">{finding.evidence.map((evidence) => <blockquote key={`${evidence.label}-${evidence.excerpt}`} className="rounded-lg border-l-4 border-[var(--mint)] bg-white p-4"><Quote className="size-4 text-[var(--muted)]" /><p className="mt-2 text-sm leading-6">“{evidence.excerpt}”</p><footer className="mt-2 text-xs font-bold text-[var(--muted)]">{evidence.label}</footer></blockquote>)}</div></details></div>
      </div>
    </Card>
  );
}
