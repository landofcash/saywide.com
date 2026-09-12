import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReportPresentation, finishReportPresentation, hasPendingReportPresentation, rememberReportPresentation } from "./report-presentation";

describe("report presentation pacing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("plays every stage for three seconds when the report finishes in five seconds", () => {
    const changes: Array<[number, number]> = [];
    const started = performance.now();
    const sequence = createReportPresentation(step => changes.push([step, performance.now() - started]));
    sequence.update(1);
    vi.advanceTimersByTime(5000);
    sequence.update(4);
    vi.advanceTimersByTime(7799);
    expect(changes).toEqual([[1, 3000], [2, 6000], [3, 9000], [4, 12000]]);
    vi.advanceTimersByTime(1);
    expect(changes.at(-1)).toEqual([5, 12800]);
    sequence.dispose();
  });

  it("does not skip stages even when the first response is already complete", () => {
    const onStep = vi.fn();
    const sequence = createReportPresentation(onStep);
    sequence.update(4);
    vi.advanceTimersByTime(2999);
    expect(onStep).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStep.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(9800);
    expect(onStep.mock.calls).toEqual([[1], [2], [3], [4], [5]]);
  });

  it("overlaps processing time, holds a slow stage, and ignores stale progress", () => {
    const onStep = vi.fn();
    const sequence = createReportPresentation(onStep);
    sequence.update(1);
    vi.advanceTimersByTime(15000);
    expect(onStep.mock.calls).toEqual([[1]]);
    sequence.update(0);
    sequence.update(1);
    vi.advanceTimersByTime(1000);
    expect(onStep.mock.calls).toEqual([[1]]);
    sequence.update(3);
    vi.advanceTimersByTime(0);
    expect(onStep.mock.calls).toEqual([[1], [2]]);
    vi.advanceTimersByTime(3000);
    expect(onStep.mock.calls).toEqual([[1], [2], [3]]);
    vi.advanceTimersByTime(10000);
    expect(onStep).toHaveBeenCalledTimes(3);
    sequence.update(4);
    vi.advanceTimersByTime(0);
    expect(onStep).toHaveBeenLastCalledWith(4);
    vi.advanceTimersByTime(800);
    expect(onStep).toHaveBeenLastCalledWith(5);
  });

  it("repeated polling does not restart the active stage timer", () => {
    const onStep = vi.fn();
    const sequence = createReportPresentation(onStep);
    for (let i = 0; i < 3; i++) {
      sequence.update(1);
      vi.advanceTimersByTime(1000);
    }
    expect(onStep.mock.calls).toEqual([[1]]);
    sequence.dispose();
  });

  it("cancels queued animations immediately on failure or unmount", () => {
    const onStep = vi.fn();
    const sequence = createReportPresentation(onStep);
    sequence.update(4);
    vi.advanceTimersByTime(1000);
    sequence.dispose();
    sequence.update(4);
    vi.advanceTimersByTime(30000);
    expect(onStep).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not publish a report after unmounting during the completion transition", () => {
    const onStep = vi.fn();
    const sequence = createReportPresentation(onStep);
    sequence.update(4);
    vi.advanceTimersByTime(12000);
    sequence.dispose();
    vi.advanceTimersByTime(800);
    expect(onStep.mock.calls).toEqual([[1], [2], [3], [4]]);
  });

  it("remembers new reports until presentation completes without requiring browser storage", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() { throw new Error("Storage disabled"); },
      setItem() { throw new Error("Storage disabled"); },
      removeItem() { throw new Error("Storage disabled"); },
    });
    expect(hasPendingReportPresentation("fast-report")).toBe(false);
    rememberReportPresentation("fast-report");
    expect(hasPendingReportPresentation("fast-report")).toBe(true);
    finishReportPresentation("fast-report");
    expect(hasPendingReportPresentation("fast-report")).toBe(false);
  });
});
