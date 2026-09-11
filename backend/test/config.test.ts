import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const requiredEnvironment: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgres://saywide:password@localhost:5432/saywide",
  TOKEN_DERIVATION_SECRET: "test-only-derivation-secret-with-32-characters",
};

describe("backend configuration", () => {
  it("keeps proxy trust disabled unless it is explicitly enabled", () => {
    expect(loadConfig(requiredEnvironment).trustProxy).toBe(false);
    expect(loadConfig({ ...requiredEnvironment, TRUST_PROXY: "true" }).trustProxy).toBe(true);
  });

  it("rejects ambiguous proxy trust values", () => {
    expect(() => loadConfig({ ...requiredEnvironment, TRUST_PROXY: "yes" })).toThrow();
    expect(() => loadConfig({ ...requiredEnvironment, TRUST_PROXY: "1" })).toThrow();
  });
});
