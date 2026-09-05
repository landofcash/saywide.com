"use client";

import type { SurveyDetail } from "@saywide/contracts";
import { Check, Clipboard, Download, ExternalLink, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export function ShareScreen({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void api.getSurvey(surveyId).then(setSurvey);
  }, [surveyId]);

  if (!survey) return <OrganizerShell><div className="h-96 animate-pulse rounded-[2rem] bg-white/60" /></OrganizerShell>;
  const path = survey.participantUrl ?? `/s/${survey.publicToken ?? "preview"}`;
  const shareUrl = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function downloadQr() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${survey?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <OrganizerShell>
      <div className="mx-auto max-w-4xl text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--mint)] shadow-[0_6px_0_#4f9575]"><Check className="size-8" strokeWidth={3} /></span>
        <Badge tone="open" className="mt-5">Survey is open</Badge>
        <h1 className="font-display mx-auto mt-4 max-w-3xl text-5xl font-bold tracking-[-0.055em] sm:text-6xl">Ready to hear from your group</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">Share this participant-only link. It contains no organizer credentials and asks for no participant account.</p>

        <Card className="mt-9 grid gap-8 p-5 text-left sm:p-8 md:grid-cols-[1fr_260px] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral-dark)]">Participant link</p>
            <h2 className="font-display mt-2 text-3xl font-bold">{survey.title}</h2>
            <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-3">
              <p className="break-all text-sm font-semibold">{shareUrl}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="accent" onClick={copyLink}>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{copied ? "Copied" : "Copy link"}</Button>
              <Button variant="secondary" asChild><a href={path} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open preview</a></Button>
            </div>
            <p className="mt-6 text-sm text-[var(--muted)]">{survey.settings.expiresAt ? `Accepting responses until ${formatDate(survey.settings.expiresAt)}` : "No automatic closing date"}</p>
          </div>
          <div className="flex flex-col items-center rounded-3xl bg-white p-5">
            <QRCodeCanvas ref={canvasRef} value={shareUrl} size={210} level="M" marginSize={3} title={`QR code for ${survey.title}`} fgColor="#20302b" bgColor="#ffffff" />
            <Button variant="ghost" size="sm" className="mt-3" onClick={downloadQr}><Download className="size-4" /> Download QR</Button>
          </div>
        </Card>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href={`/surveys/${surveyId}`}>Survey overview</Link></Button>
          <Button asChild variant="secondary"><Link href="/dashboard"><LayoutDashboard className="size-4" /> My surveys</Link></Button>
          <Button asChild variant="ghost"><Link href="/account/create"><ShieldCheck className="size-4" /> Protect surveys</Link></Button>
        </div>
      </div>
    </OrganizerShell>
  );
}
