"use client";

import type { SurveyStatus, SurveySummary } from "@saywide/contracts";
import { ArrowRight, ChevronDown, Clock3, MessageSquare, Plus, TriangleAlert, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { useOrganizerSession } from "@/components/organizer/organizer-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, apiCapabilities } from "@/lib/api";
import { formatDate, pluralize } from "@/lib/utils";

type Filter = "all" | SurveyStatus;
const filters: Filter[] = ["all", "draft", "open", "closed", "archived"];

export function DashboardScreen() {
  const session = useOrganizerSession()?.session;
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
    <OrganizerShell>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Dashboard</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">My surveys</h1>
        </div>
        <Button asChild variant="accent" size="lg"><Link href="/create"><Plus className="size-5" /> New survey</Link></Button>
      </div>

      {apiCapabilities.accounts && session?.workspace?.kind === "guest" && <Card className="mt-8 border-amber-200 bg-amber-50 p-4 shadow-none sm:p-5">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md font-bold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--coral)] [&::-webkit-details-marker]:hidden">
            <TriangleAlert className="size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="flex-1">Keep access to your surveys.</span>
            <ChevronDown className="size-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <div className="pt-2 sm:pl-8">
            <p className="max-w-2xl text-sm leading-6 text-amber-950/80">Create an account to keep access to your surveys. Guest access is linked to this browser. If the browser is reset or its data is cleared, you will permanently lose access to them.</p>
            <Button asChild variant="secondary" size="sm" className="mt-4 w-full sm:w-auto"><Link href="/account/create"><UserPlus className="size-4" aria-hidden="true" />Create an account</Link></Button>
          </div>
        </details>
      </Card>}

      {session?.workspace?.kind === "registered" && session.guestSurveyCount > 0 && <Card className="mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">This browser also has {session.guestSurveyCount} guest {session.guestSurveyCount === 1 ? "survey" : "surveys"}.</p>
        <Button asChild variant="secondary" size="sm"><Link href="/account/claim?next=%2Fdashboard">Move guest surveys</Link></Button>
      </Card>}

      <div className="mt-8 overflow-x-auto pb-1">
        <div role="group" aria-label="Filter surveys" className="flex min-w-max w-full sm:inline-flex sm:w-auto">
          {filters.map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`relative -ml-px min-h-9 flex-1 border sm:flex-none px-3 text-xs font-semibold capitalize first:ml-0 first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coral)] ${filter === item ? "z-[1] border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--mint-soft)]"}`}>
              {item}
            </button>
          ))}
        </div>
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
                <Card className="flex h-full min-h-64 flex-col p-5 transition duration-150 group-hover:border-[#87938e] group-hover:shadow-[0_4px_14px_rgba(16,24,21,0.08)] sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <Badge tone={survey.status === "open" ? "open" : survey.status === "draft" ? "draft" : "closed"} className="gap-1.5 rounded-full px-2.5 py-0.5">
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      {survey.status}
                    </Badge>
                    <ArrowRight className="size-5 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--ink)]" />
                  </div>
                  <h2 className="font-display mt-4 break-words text-xl font-bold leading-snug tracking-[-0.025em]">{survey.title}</h2>
                  <div className="mt-auto flex items-center gap-3 pt-6">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--mint-soft)] text-[var(--coral)]"><MessageSquare className="size-5" aria-hidden="true" /></span>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold text-[var(--ink)]">
                      {survey.submittedResponseCount === 0 ? "No responses yet" : <><span className="font-display text-3xl font-bold tabular-nums tracking-tight">{survey.submittedResponseCount}</span><span>{survey.submittedResponseCount === 1 ? "response" : "responses"}</span></>}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
                    <span>{pluralize(survey.questionCount, "question")}</span>
                    <span className="flex items-center gap-1"><Clock3 className="size-3.5" /> {survey.expiresAt ? `Ends ${formatDate(survey.expiresAt)}` : "No expiry"}</span>
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
