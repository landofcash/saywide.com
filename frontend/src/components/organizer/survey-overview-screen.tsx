"use client";

import type { ReportSummary, SurveyDetail } from "@saywide/contracts";
import { ArrowLeft, BarChart3, CalendarClock, Clipboard, ExternalLink, FileText, Lock, Pencil, QrCode, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, pluralize } from "@/lib/utils";

export function SurveyOverviewScreen({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [changing, setChanging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void Promise.all([api.getSurvey(surveyId), api.listReports(surveyId)]).then(([surveyItem, reportItems]) => {
      setSurvey(surveyItem);
      setReports(reportItems);
    });
  }, [surveyId]);

  if (!survey) return <OrganizerShell><div className="h-96 animate-pulse rounded-[2rem] bg-white/60" /></OrganizerShell>;

  const thresholdMet = survey.submittedResponseCount >= survey.settings.minReportResponses;
  const progress = Math.min(100, (survey.submittedResponseCount / survey.settings.minReportResponses) * 100);
  const participantPath = survey.participantUrl ?? "";

  async function changeStatus() {
    const next = survey?.status === "open" ? "closed" : "open";
    if (!survey || !window.confirm(`${next === "closed" ? "Close" : "Reopen"} this survey? Existing responses will be kept.`)) return;
    setChanging(true);
    const updated = await api.changeSurveyStatus(survey.surveyId, next);
    setSurvey(updated);
    setChanging(false);
  }

  async function copyLink() {
    if (!participantPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${participantPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <OrganizerShell wide>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> My surveys</Link>
      <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <Badge tone={survey.status === "open" ? "open" : survey.status === "draft" ? "draft" : "closed"}>{survey.status}</Badge>
          <h1 className="font-display mt-3 text-5xl font-bold tracking-[-0.055em] sm:text-6xl">{survey.title}</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">{survey.introduction}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {participantPath && <Button variant="secondary" onClick={copyLink}><Clipboard className="size-4" /> {copied ? "Copied" : "Copy link"}</Button>}
          {participantPath && <Button variant="secondary" asChild><Link href={`/surveys/${surveyId}/share`}><QrCode className="size-4" /> Show QR</Link></Button>}
          <Button variant={survey.status === "open" ? "danger" : "secondary"} onClick={changeStatus} disabled={changing || survey.status === "draft"}>{survey.status === "open" ? <Lock className="size-4" /> : <RotateCcw className="size-4" />}{changing ? "Updating…" : survey.status === "open" ? "Close survey" : "Reopen"}</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Submitted responses" value={String(survey.submittedResponseCount)} detail="Not verified people" accent="mint" />
        <Metric label="In progress" value={String(Math.max(0, survey.startedResponseCount - survey.submittedResponseCount))} detail={`${survey.startedResponseCount} sessions started`} accent="yellow" />
        <Metric label="Questions" value={String(survey.questionCount)} detail="Open-ended" accent="lavender" />
        <Metric label="Closes" value={survey.settings.expiresAt ? formatDate(survey.settings.expiresAt, { month: "short", day: "numeric" }) : "Manual"} detail={survey.settings.expiresAt ? formatDate(survey.settings.expiresAt) : "No expiry set"} accent="coral" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Report readiness</p><h2 className="font-display mt-2 text-3xl font-bold">{thresholdMet ? "Ready to understand" : "Keep collecting"}</h2></div><BarChart3 className="size-7" /></div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{thresholdMet ? `${survey.submittedResponseCount} responses can be included in a new frozen snapshot.` : `${survey.settings.minReportResponses - survey.submittedResponseCount} more responses are needed for the privacy threshold.`}</p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--canvas)]" aria-label={`${Math.round(progress)} percent toward report threshold`}><div className="h-full rounded-full bg-[var(--mint)]" style={{ width: `${progress}%` }} /></div>
          <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--muted)]"><span>{pluralize(survey.submittedResponseCount, "response")}</span><span>Minimum {survey.settings.minReportResponses}</span></div>
          <Button asChild={thresholdMet} disabled={!thresholdMet} variant="accent" className="mt-6 w-full">
            {thresholdMet ? <Link href={`/surveys/${surveyId}/reports/new`}><FileText className="size-4" /> Create report</Link> : <span><FileText className="size-4" /> Create report</span>}
          </Button>
        </Card>

        <Card className="p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Report history</p><h2 className="font-display mt-2 text-3xl font-bold">What you have asked</h2></div><FileText className="size-7" /></div>
          {reports.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">No reports yet. Once the threshold is met, ask Saywide what you need to understand.</div>
          ) : (
            <div className="mt-5 divide-y divide-[var(--line)]">
              {reports.map((report) => <Link href={`/reports/${report.reportId}`} key={report.reportId} className="group flex items-start justify-between gap-4 py-4 first:pt-0"><div><p className="line-clamp-2 font-semibold leading-6">{report.instruction}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]"><CalendarClock className="size-3.5" /> Snapshot {formatDateTime(report.snapshotAt)}</p></div><ExternalLink className="mt-1 size-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" /></Link>)}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {participantPath && <Button variant="secondary" asChild><a href={participantPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Participant preview</a></Button>}
        <Button variant="ghost" asChild><Link href={`/surveys/${surveyId}/edit`}><Pencil className="size-4" /> Edit survey</Link></Button>
      </div>
    </OrganizerShell>
  );
}

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: "mint" | "yellow" | "lavender" | "coral" }) {
  const colors = { mint: "bg-[var(--mint-soft)]", yellow: "bg-amber-50", lavender: "bg-violet-50", coral: "bg-orange-50" };
  return <Card className={`${colors[accent]} p-5`}><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p><p className="font-display mt-3 text-4xl font-bold tracking-[-0.04em]">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{detail}</p></Card>;
}
