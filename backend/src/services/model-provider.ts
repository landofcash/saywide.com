import { BedrockModel } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";

export type ModelProvider = "openai" | "bedrock";
export type OpenAIReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export type AgentModelOptions =
  | {
      provider: "openai";
      modelId: string;
      maxTokens: number;
      reasoningEffort?: OpenAIReasoningEffort;
    }
  | {
      provider: "bedrock";
      modelId: string;
      region: string;
      maxTokens: number;
      temperature?: number;
    };

export function createAgentModel(options: AgentModelOptions): OpenAIModel | BedrockModel {
  if (options.provider === "openai") {
    return new OpenAIModel({
      api: "responses",
      modelId: options.modelId,
      maxTokens: options.maxTokens,
      stateful: false,
      params: options.reasoningEffort
        ? { reasoning: { effort: options.reasoningEffort } }
        : undefined,
    });
  }

  return new BedrockModel({
    region: options.region,
    modelId: options.modelId,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    stream: true,
    clientConfig: {
      maxAttempts: 5,
      retryMode: "adaptive",
    },
  });
}
