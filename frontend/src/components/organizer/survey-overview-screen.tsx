"use client";

import type { ReportSummary, SurveyDetail } from "@saywide/contracts";
import { ArrowLeft, BarChart3, CalendarClock, Clipboard, ExternalLink, FileText, Lock, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, apiCapabilities } from "@/lib/api";
import { formatDate, formatDateTime, pluralize } from "@/lib/utils";

export function SurveyOverviewScreen({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [changing, setChanging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void Promise.all([
      api.getSurvey(surveyId),
      apiCapabilities.reports ? api.listReports(surveyId) : Promise.resolve([]),
    ]).then(([surveyItem, reportItems]) => {
      setSurvey(surveyItem);
      setReports(reportItems);
    });
  }, [surveyId]);

  if (!survey) return <OrganizerShell><div className="h-96 animate-pulse rounded-xl bg-white" /></OrganizerShell>;

  const thresholdMet = survey.submittedResponseCount >= survey.settings.minReportResponses;
  const progress = Math.min(100, (survey.submittedResponseCount / survey.settings.minReportResponses) * 100);
  const participantPath = survey.participantUrl ?? "";
  const participantUrl = typeof window === "undefined" ? participantPath : `${window.location.origin}${participantPath}`;
  const inProgressCount = Math.max(0, survey.startedResponseCount - survey.submittedResponseCount);

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
    <OrganizerShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" /> My surveys</Link>
      <div className="mt-4 max-w-3xl">
          <h1 className="font-display text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{survey.title}</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">{survey.introduction}</p>
      </div>

      <div className={`mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 ${participantPath ? "xl:grid-cols-[1.15fr_1fr_1fr]" : "xl:grid-cols-2"}`}>
        {participantPath && (
          <Card className="flex flex-col border-t-4 border-t-slate-500 bg-white p-5 sm:col-span-2 xl:col-span-1">
            <div className="flex flex-1 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Scan to respond</p>
                <p className="mt-3 text-sm font-semibold leading-5">Open the survey on any phone</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">The participant link is encoded here.</p>
              </div>
              <div className="shrink-0 rounded-lg border border-[var(--line)] bg-white p-2">
                <QRCodeSVG value={participantUrl} size={108} level="M" marginSize={1} title={`QR code for ${survey.title}`} fgColor="#17231f" bgColor="#ffffff" />
              </div>
            </div>
            <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={copyLink}><Clipboard className="size-4 shrink-0" /> {copied ? "Copied" : "Copy link"}</Button>
          </Card>
        )}
        <Card className="border-t-4 border-t-emerald-700 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Response activity</p>
          <div className="mt-3 grid grid-cols-2 divide-x divide-[var(--line)]">
            <div className="pr-4">
              <p className="font-display text-3xl font-bold tracking-[-0.025em]">{survey.submittedResponseCount}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Submitted</p>
            </div>
            <div className="pl-4">
              <p className="font-display text-3xl font-bold tracking-[-0.025em]">{inProgressCount}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">In progress</p>
            </div>
          </div>
        </Card>
        <Metric label="Closes" status={survey.status} value={survey.settings.expiresAt ? formatDate(survey.settings.expiresAt, { month: "short", day: "numeric" }) : "Manual"} detail={survey.settings.expiresAt ? formatDate(survey.settings.expiresAt) : "No expiry set"}>
          <Button variant={survey.status === "open" ? "danger" : "secondary"} size="sm" className="w-full" onClick={changeStatus} disabled={changing || survey.status === "draft"}>{survey.status === "open" ? <Lock className="size-4 shrink-0" /> : <RotateCcw className="size-4 shrink-0" />}{changing ? "Updating…" : survey.status === "open" ? "Close survey" : "Reopen"}</Button>
        </Metric>
      </div>

      {apiCapabilities.reports && (reports.length === 0 ? (
        <Card className="mt-6 border-emerald-200 bg-[var(--mint-soft)] p-6 sm:p-8">
          <div className="grid items-center gap-6 lg:grid-cols-[0.85fr_1fr] lg:gap-8">
            <div className="border-b border-emerald-900/10 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold"><span className="font-display mr-1 text-2xl font-bold tabular-nums tracking-tight">{survey.submittedResponseCount}</span> {survey.submittedResponseCount === 1 ? "response" : "responses"}</p>
                <p className="text-xs text-[var(--muted)]">Minimum {survey.settings.minReportResponses}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-900/10" role="progressbar" aria-label="Progress toward first report" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div className="h-full rounded-full bg-[var(--mint)]" style={{ width: `${progress}%` }} /></div>
              <Button asChild={thresholdMet} disabled={!thresholdMet} variant="accent" className="mt-5 w-full whitespace-nowrap">
                {thresholdMet ? <Link href={`/surveys/${surveyId}/reports/new`}><FileText className="size-4 shrink-0" /> Create first report</Link> : <><FileText className="size-4 shrink-0" /> Create first report</>}
              </Button>
            </div>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Your first report</p>
              <h2 className="font-display mt-2 text-xl font-bold leading-snug tracking-tight sm:text-2xl">{thresholdMet ? "Your responses are ready to explore" : "Insights will appear here"}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {thresholdMet ? `Create a private snapshot from ${survey.submittedResponseCount} submitted responses and ask Saywide what you want to understand.` : `Keep collecting responses. Reports become available at ${survey.settings.minReportResponses} submitted responses to protect participant privacy.`}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <Card className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Report readiness</p><h2 className="font-display mt-2 text-2xl font-bold">{thresholdMet ? "Ready to understand" : "Keep collecting"}</h2></div><BarChart3 className="size-6" /></div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{thresholdMet ? `${survey.submittedResponseCount} responses can be included in a new frozen snapshot.` : `${survey.settings.minReportResponses - survey.submittedResponseCount} more responses are needed for the privacy threshold.`}</p>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--canvas)]" aria-label={`${Math.round(progress)} percent toward report threshold`}><div className="h-full rounded-full bg-[var(--mint)]" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--muted)]"><span>{pluralize(survey.submittedResponseCount, "response")}</span><span>Minimum {survey.settings.minReportResponses}</span></div>
            <Button asChild={thresholdMet} disabled={!thresholdMet} variant="accent" className="mt-6 w-full whitespace-nowrap">
              {thresholdMet ? <Link href={`/surveys/${surveyId}/reports/new`}><FileText className="size-4 shrink-0" /> Create report</Link> : <><FileText className="size-4 shrink-0" /> Create report</>}
            </Button>
          </Card>

          <Card className="p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Report history</p><h2 className="font-display mt-2 text-2xl font-bold">What you have asked</h2></div><FileText className="size-6" /></div>
            <div className="mt-5 divide-y divide-[var(--line)]">
              {reports.map((report) => <Link href={`/reports/${report.reportId}`} key={report.reportId} className="group flex items-start justify-between gap-4 py-4 first:pt-0"><div><p className="line-clamp-2 font-semibold leading-6">{report.instruction}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]"><CalendarClock className="size-3.5" /> Snapshot {formatDateTime(report.snapshotAt)}</p></div><ExternalLink className="mt-1 size-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--ink)]" /></Link>)}
            </div>
          </Card>
        </div>
      ))}

      <div className="mt-6 flex flex-wrap gap-2">
        {participantPath && <Button variant="secondary" asChild><a href={participantPath} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Participant preview</a></Button>}
        <Button variant="ghost" asChild><Link href={`/surveys/${surveyId}/edit`}><Pencil className="size-4" /> Edit survey</Link></Button>
      </div>
    </OrganizerShell>
  );
}

function Metric({ label, value, detail, status, children }: { label: string; value: string; detail: string; status: SurveyDetail["status"]; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col border-t-4 border-t-[var(--coral)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
        <Badge tone={status === "open" ? "open" : status === "draft" ? "draft" : "closed"} className="gap-1.5 rounded-full px-2.5 py-0.5">
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {status}
        </Badge>
      </div>
      <p className="font-display mt-3 text-3xl font-bold tracking-[-0.025em]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      <div className="mt-auto pt-4">{children}</div>
    </Card>
  );
}
