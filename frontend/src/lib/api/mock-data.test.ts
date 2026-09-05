import { surveyDetailSchema } from "@saywide/contracts";
import { describe, expect, it } from "vitest";

import { createInitialState } from "./mock-data";

describe("mock data", () => {
  it("keeps seeded surveys inside the shared API contract", () => {
    const state = createInitialState();
    expect(state.surveys.length).toBeGreaterThan(0);
    for (const survey of state.surveys) {
      expect(surveyDetailSchema.safeParse(survey).success).toBe(true);
    }
  });

  it("connects the seeded report to an eligible survey", () => {
    const state = createInitialState();
    const report = state.reports[0];
    const survey = state.surveys.find((item) => item.surveyId === report.surveyId);
    expect(survey).toBeDefined();
    expect(report.eligibleResponseCount).toBe(survey?.submittedResponseCount);
  });
});
