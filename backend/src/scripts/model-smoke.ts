import { configureLogging } from "@strands-agents/sdk";

import { loadConfig } from "../config.js";
import { runModelSmokeTest } from "../services/model-smoke.js";

configureLogging({
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
});

function safeErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(error.name) ? error.name : "Error";
}

function safeHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number") return error.status;
  if ("$metadata" in error && error.$metadata && typeof error.$metadata === "object") {
    const metadata = error.$metadata as { httpStatusCode?: unknown };
    return typeof metadata.httpStatusCode === "number" ? metadata.httpStatusCode : undefined;
  }
  return undefined;
}

function safeErrorDetails(error: unknown): {
  errorName: string;
  causeName?: string;
  httpStatusCode?: number;
  providerReason?: string;
} {
  const errorName = safeErrorName(error);
  if (!(error instanceof Error)) return { errorName };

  const cause = error.cause;
  const causeName = cause instanceof Error ? safeErrorName(cause) : undefined;
  const httpStatusCode = safeHttpStatus(cause) ?? safeHttpStatus(error);
  const messages = [error.message, cause instanceof Error ? cause.message : ""].join("\n");
  const providerReason = [
    [/incorrect api key|invalid api key|authentication/i, "INVALID_CREDENTIALS"],
    [/insufficient_quota|exceeded.*quota|billing/i, "QUOTA_OR_BILLING_REQUIRED"],
    [/rate limit/i, "RATE_LIMITED"],
    [/temperature/i, "INVALID_TEMPERATURE"],
    [/on-demand throughput/i, "INFERENCE_PROFILE_REQUIRED"],
    [/model identifier/i, "INVALID_MODEL_ID"],
    [/model access|use case|model .*not found|does not exist/i, "MODEL_ACCESS_REQUIRED"],
    [/operation not allowed/i, "MODEL_OPERATION_NOT_ALLOWED"],
    [/payment instrument/i, "PAYMENT_INSTRUMENT_REQUIRED"],
    [/not authorized|access denied|explicit deny/i, "ACCESS_DENIED"],
    [/max.?tokens/i, "INVALID_MAX_TOKENS"],
    [/security token|credential/i, "INVALID_CREDENTIALS"],
  ].find(([pattern]) => (pattern as RegExp).test(messages))?.[1] as string | undefined;

  return {
    errorName,
    causeName,
    httpStatusCode,
    providerReason: providerReason ?? "UNCLASSIFIED",
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = config.modelProvider;
  const modelId = provider === "openai" ? config.openAiModelId : config.bedrockModelId;
  const region = provider === "bedrock" ? config.awsRegion : undefined;

  try {
    const result = await runModelSmokeTest({ provider, modelId, region });
    process.stdout.write(`${JSON.stringify({ event: "model_strands_smoke_succeeded", ...result })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      event: "model_strands_smoke_failed",
      provider,
      framework: "strands-agents",
      region,
      modelId,
      ...safeErrorDetails(error),
    })}\n`);
    process.exitCode = 1;
  }
}

void main();
