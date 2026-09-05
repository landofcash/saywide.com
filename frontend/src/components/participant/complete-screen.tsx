"use client";

import { Check, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSubmittedAt } from "@/lib/participant-state";
import { formatDateTime } from "@/lib/utils";

export function CompleteScreen({ publicToken }: { publicToken: string }) {
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSubmittedAt(window.sessionStorage.getItem(`saywide.completed.${publicToken}`) ?? getSubmittedAt(publicToken)), 0);
    return () => window.clearTimeout(timer);
  }, [publicToken]);
  return <ParticipantShell><Card className="mx-auto mt-10 max-w-xl p-7 text-center sm:p-10"><span className="mx-auto grid size-20 place-items-center rounded-full bg-[var(--mint)] shadow-[0_6px_0_#4f9575]"><Check className="size-10" strokeWidth={3} /></span><p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Submitted safely</p><h1 className="font-display mt-3 text-5xl font-bold tracking-[-0.05em]">Response received</h1><p className="mt-4 leading-7 text-[var(--muted)]">Thank you for sharing your perspective. Only the text you reviewed was stored; no voice recording was kept.</p>{submittedAt && <p className="mt-4 text-xs font-semibold text-[var(--muted)]">Received {formatDateTime(submittedAt)}</p>}<div className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-[var(--canvas)] p-4 text-sm font-semibold"><LockKeyhole className="size-4" /> You did not create an account or participant profile.</div><Button variant="secondary" className="mt-6" onClick={() => window.close()}>Done</Button></Card></ParticipantShell>;
}
