export const REPORT_STAGE_MIN_MS = 3000;
export const REPORT_READY_MS = 800;

export const reportStages = [
  { progress: "Preparing response snapshot", label: "Gathering responses", title: "Every voice, brought together.", description: "Bringing the submitted responses into one complete picture." },
  { progress: "Finding themes", label: "Finding themes", title: "Individual voices. Shared ideas.", description: "Looking for recurring ideas, different perspectives, and meaningful connections." },
  { progress: "Checking evidence", label: "Checking evidence", title: "Insights grounded in what was said.", description: "Checking findings against the responses that support them." },
  { progress: "Writing report", label: "Creating your report", title: "A clearer picture takes shape.", description: "Bringing the findings, supporting evidence, and next steps together." },
] as const;

/** Presentation time overlaps processing time. A later signal never skips a scene. */
export function createReportPresentation(onStep: (step: number) => void) {
  let step = 0;
  let available = 0;
  let enteredAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function schedule() {
    if (disposed || timer !== undefined || step > reportStages.length) return;
    if (step < reportStages.length && available <= step) return;
    const duration = step === reportStages.length ? REPORT_READY_MS : REPORT_STAGE_MIN_MS;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed) return;
      step += 1;
      enteredAt = performance.now();
      onStep(step);
      schedule();
    }, Math.max(0, duration - (performance.now() - enteredAt)));
  }

  return {
    update(availableStep: number) {
      available = Math.max(available, Math.min(reportStages.length, availableStep));
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}

const pending = new Set<string>();
const key = (reportId: string) => `saywide.report-presentation.${reportId}`;

// Also remember immediate completions (including the demo API) across navigation.
// The in-memory fallback allows creation even when browser storage is disabled.
export function rememberReportPresentation(reportId: string) {
  pending.add(reportId);
  try { sessionStorage.setItem(key(reportId), "pending"); } catch { /* Optional persistence. */ }
}

export function hasPendingReportPresentation(reportId: string) {
  if (pending.has(reportId)) return true;
  try { return sessionStorage.getItem(key(reportId)) === "pending"; } catch { return false; }
}

export function finishReportPresentation(reportId: string) {
  pending.delete(reportId);
  try { sessionStorage.removeItem(key(reportId)); } catch { /* Optional persistence. */ }
}
