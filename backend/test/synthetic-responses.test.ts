import { describe, expect, it } from "vitest";

import { syntheticResponses } from "./fixtures/synthetic-responses.js";

describe("synthetic report fixture", () => {
  it("stays deterministic and within the documented demo size", () => {
    expect(syntheticResponses).toHaveLength(24);
    expect(new Set(syntheticResponses.map((response) => response.fixtureId)).size).toBe(24);
    expect(syntheticResponses.every((response) => response.workedWell && response.friction && response.nextChange)).toBe(true);
  });
});
