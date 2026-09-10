import { describe, expect, it } from "vitest";

import { runModelSmokeTest } from "../src/services/model-smoke.js";

describe("provider-neutral Strands smoke test", () => {
  it("returns safe OpenAI operational metadata for the expected response", async () => {
    const result = await runModelSmokeTest({
      provider: "openai",
      modelId: "gpt-5.6-luna",
      invoke: async () => ({
        text: "SAYWIDE_MODEL_OK\n",
        stopReason: "endTurn",
        inputTokens: 18,
        outputTokens: 7,
        totalTokens: 25,
        modelLatencyMs: 120,
      }),
    });

    expect(result).toMatchObject({
      provider: "openai",
      framework: "strands-agents",
      modelId: "gpt-5.6-luna",
      stopReason: "endTurn",
      inputTokens: 18,
      outputTokens: 7,
      totalTokens: 25,
      modelLatencyMs: 120,
    });
    expect(result.region).toBeUndefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("preserves Bedrock as a configurable fallback", async () => {
    const result = await runModelSmokeTest({
      provider: "bedrock",
      modelId: "amazon.nova-micro-v1:0",
      region: "us-east-1",
      invoke: async () => ({ text: "SAYWIDE_MODEL_OK", stopReason: "endTurn" }),
    });

    expect(result).toMatchObject({
      provider: "bedrock",
      region: "us-east-1",
      modelId: "amazon.nova-micro-v1:0",
    });
  });

  it("fails without exposing unexpected model output", async () => {
    await expect(runModelSmokeTest({
      provider: "openai",
      modelId: "gpt-5.6-luna",
      invoke: async () => ({ text: "unexpected private output", stopReason: "endTurn" }),
    })).rejects.toThrow("Model smoke test returned an unexpected response.");
  });
});
