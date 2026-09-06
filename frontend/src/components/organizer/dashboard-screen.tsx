"use client";

import type { SurveyStatus, SurveySummary } from "@saywide/contracts";
import { ArrowRight, Clock3, FileText, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, pluralize } from "@/lib/utils";

type Filter = "all" | SurveyStatus;
const filters: Filter[] = ["all", "draft", "open", "closed", "archived"];

export function DashboardScreen() {
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listSurveys().then((items) => {
      setSurveys(items);
      setLoading(false);
    });
  }, []);

  const visible = filter === "all" ? surveys : surveys.filter((survey) => survey.status === filter);

  return (
    <OrganizerShell wide>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Your workspace</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">My surveys</h1>
          <p className="mt-3 text-[var(--muted)]">Follow collection, share a link, or turn responses into a report.</p>
        </div>
        <Button asChild variant="accent" size="lg"><Link href="/"><Plus className="size-5" /> New survey</Link></Button>
      </div>

      <Card className="mt-8 flex flex-col gap-4 border-l-4 border-l-[var(--coral)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--mint-soft)]"><ShieldCheck className="size-5 text-emerald-800" /></span>
          <div><p className="font-bold">These surveys are saved to this browser</p><p className="mt-1 text-sm text-emerald-950/70">Create an account when you want recovery and access from another device.</p></div>
        </div>
        <Button asChild variant="secondary" size="sm"><Link href="/account/create">Protect my surveys</Link></Button>
      </Card>

      <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter surveys">
        {filters.map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`min-h-10 rounded-lg border px-4 text-sm font-semibold capitalize ${filter === item ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]"}`}>
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3" aria-label="Loading surveys">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-white" />)}</div>
      ) : visible.length === 0 ? (
        <Card className="mt-5 p-10 text-center"><h2 className="font-display text-3xl font-bold">Nothing here yet</h2><p className="mt-2 text-[var(--muted)]">Create a survey or choose another status.</p></Card>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {visible.map((survey) => {
            const href = survey.status === "draft" ? `/surveys/${survey.surveyId}/edit` : `/surveys/${survey.surveyId}`;
            return (
              <Link href={href} key={survey.surveyId} className="group block">
                <Card className="flex h-full min-h-64 flex-col p-6 transition duration-150 group-hover:border-[#87938e] group-hover:shadow-[0_4px_14px_rgba(16,24,21,0.08)]">
                  <div className="flex items-start justify-between gap-4">
                    <Badge tone={survey.status === "open" ? "open" : survey.status === "draft" ? "draft" : "closed"}>{survey.status}</Badge>
                    <ArrowRight className="size-5 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--ink)]" />
                  </div>
                  <h2 className="font-display mt-5 text-2xl font-bold leading-tight tracking-[-0.035em]">{survey.title}</h2>
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-8 text-sm">
                    <div className="rounded-lg bg-[var(--canvas)] p-3"><p className="text-2xl font-bold">{survey.submittedResponseCount}</p><p className="text-xs text-[var(--muted)]">submissions</p></div>
                    <div className="rounded-lg bg-[var(--canvas)] p-3"><p className="text-2xl font-bold">{survey.questionCount}</p><p className="text-xs text-[var(--muted)]">questions</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1"><FileText className="size-3.5" /> {survey.reportState}</span>
                    <span className="flex items-center gap-1"><Clock3 className="size-3.5" /> {survey.expiresAt ? `Ends ${formatDate(survey.expiresAt)}` : pluralize(survey.questionCount, "question")}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </OrganizerShell>
  );
}
