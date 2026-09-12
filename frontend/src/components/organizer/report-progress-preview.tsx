"use client";

import { useEffect, useState } from "react";
import type { ReportActivity } from "@saywide/contracts";

import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { ReportProgress } from "@/components/organizer/report-progress";
import { ActivityTimeline } from "@/components/organizer/report-screen";
import { Button } from "@/components/ui/button";
import { createReportPresentation, reportStages } from "@/lib/report-presentation";

const sampleEvents: Array<{ step: number; type: string; label: string; source: ReportActivity["source"]; durationMs: number | null }> = [
  { step: 0, type: "queued", label: "Report queued", source: "workflow", durationMs: null },
  { step: 0, type: "snapshot_started", label: "Preparing response snapshot", source: "workflow", durationMs: null },
  { step: 1, type: "snapshot_loaded", label: "Response snapshot loaded", source: "workflow", durationMs: 180 },
  { step: 1, type: "skills_available", label: "Analysis guidance catalogue recorded", source: "workflow", durationMs: null },
  { step: 1, type: "model_started", label: "Model call started", source: "agent", durationMs: null },
  { step: 1, type: "tool_started", label: "Inspect snapshot: started", source: "agent", durationMs: null },
  { step: 1, type: "tool_completed", label: "Inspect snapshot: completed", source: "agent", durationMs: 120 },
  { step: 1, type: "skill_activated", label: "Loaded feedback synthesis guidance", source: "agent", durationMs: null },
  { step: 2, type: "skill_activated", label: "Loaded evidence review guidance", source: "agent", durationMs: null },
  { step: 2, type: "model_completed", label: "Model call completed", source: "agent", durationMs: 4200 },
  { step: 2, type: "themes_extracted", label: "Candidate findings prepared", source: "workflow", durationMs: 4500 },
  { step: 3, type: "evidence_validated", label: "References and quotes checked", source: "workflow", durationMs: 85 },
  { step: 4, type: "completed", label: "Report saved", source: "workflow", durationMs: 60 },
];

const sampleActivity = sampleEvents.map((event, index) => ({
  ...event,
  sequence: index + 1,
  createdAt: new Date(Date.UTC(2026, 8, 12, 10, 0, event.step * 3)).toISOString(),
}));

/** Local rehearsal only. The server route returns 404 outside development. */
export function ReportProgressPreview() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const presentation = createReportPresentation(next => {
      setStep(Math.min(next, reportStages.length));
      if (next > reportStages.length) setPlaying(false);
    });
    // Rehearse a report that completes before all its scenes have played.
    presentation.update(reportStages.length);
    return () => presentation.dispose();
  }, [playing]);

  return <OrganizerShell>
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--coral-dark)]">Development preview · synthetic illustration</p>
        <p className="mt-2 text-sm text-[var(--muted)]">Rehearse the full sequence or inspect a scene. No report is generated.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={playing} onClick={() => { setStep(0); setPlaying(true); }}>{playing ? "Playing all four steps…" : "Play full sequence"}</Button>
          {[...reportStages.map(stage => stage.label), "Ready"].map((label, index) => <Button key={label} size="sm" variant="secondary" disabled={playing} aria-pressed={!playing && step === index} onClick={() => setStep(index)}>{label}</Button>)}
        </div>
      </div>
      <ReportProgress step={step} />
      <ActivityTimeline activity={sampleActivity.filter(event => event.step <= step)} expanded preview />
    </div>
  </OrganizerShell>;
}
