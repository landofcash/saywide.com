import { Agent } from "@strands-agents/sdk";

import { createAgentModel, type ModelProvider } from "./model-provider.js";

const EXPECTED_RESPONSE = "SAYWIDE_MODEL_OK";

interface SmokeInvocation {
  text: string;
  stopReason: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelLatencyMs?: number;
}

export interface ModelSmokeResult {
  provider: ModelProvider;
  framework: "strands-agents";
  region?: string;
  modelId: string;
  latencyMs: number;
  modelLatencyMs?: number;
  stopReason: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelSmokeOptions {
  provider: ModelProvider;
  modelId: string;
  region?: string;
  invoke?: () => Promise<SmokeInvocation>;
}

async function invokeWithStrands(options: ModelSmokeOptions): Promise<SmokeInvocation> {
  const model = options.provider === "openai"
    ? createAgentModel({
        provider: "openai",
        modelId: options.modelId,
        maxTokens: 64,
        reasoningEffort: "none",
      })
    : createAgentModel({
        provider: "bedrock",
        modelId: options.modelId,
        region: options.region ?? "us-east-1",
        maxTokens: 32,
        temperature: 0.00001,
      });

  const agent = new Agent({
    model,
    printer: false,
    systemPrompt: `You are a connectivity test. Reply with exactly ${EXPECTED_RESPONSE} and nothing else.`,
  });

  const result = await agent.invoke(`Reply with exactly ${EXPECTED_RESPONSE} and nothing else.`);
  const usage = result.metrics?.accumulatedUsage;

  return {
    text: result.toString(),
    stopReason: result.stopReason,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    totalTokens: usage?.totalTokens,
    modelLatencyMs: result.metrics?.accumulatedMetrics.latencyMs,
  };
}

export async function runModelSmokeTest(options: ModelSmokeOptions): Promise<ModelSmokeResult> {
  const startedAt = performance.now();
  const invocation = await (options.invoke ?? (() => invokeWithStrands(options)))();

  if (invocation.text.trim() !== EXPECTED_RESPONSE) {
    throw new Error("Model smoke test returned an unexpected response.");
  }

  return {
    provider: options.provider,
    framework: "strands-agents",
    region: options.provider === "bedrock" ? options.region : undefined,
    modelId: options.modelId,
    latencyMs: Math.round(performance.now() - startedAt),
    modelLatencyMs: invocation.modelLatencyMs,
    stopReason: invocation.stopReason,
    inputTokens: invocation.inputTokens,
    outputTokens: invocation.outputTokens,
    totalTokens: invocation.totalTokens,
  };
}
