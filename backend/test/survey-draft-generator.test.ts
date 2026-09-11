import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAiSurveyDraftGenerator } from "../src/services/survey-draft-generator.js";

const { parse, construct } = vi.hoisted(() => ({ parse: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { parse }; constructor(options: unknown) { construct(options); } } }));
const draft = { title: "Team feedback", introduction: "Share your perspective.", questions: [{ prompt: "What could improve?", required: true }] };
const generator = new OpenAiSurveyDraftGenerator({ openAiModelId: "configured-model" });
beforeEach(() => { vi.clearAllMocks(); });

describe("structured survey generation", () => {
  it("uses the configured model and validates a complete, unsaved draft", async () => {
    parse.mockResolvedValue({ status: "completed", output_parsed: { draft } });
    expect(await generator.generate("Ask the team about meetings")).toEqual(draft);
    expect(construct).toHaveBeenCalledWith({ timeout: 45000, maxRetries: 0 });
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ model: "configured-model", store: false, input: JSON.stringify({ transcript: "Ask the team about meetings" }), text: { format: expect.objectContaining({ type: "json_schema", strict: true }) } }));
  });

  it("distinguishes insufficient context from provider failure", async () => {
    parse.mockResolvedValue({ status: "completed", output_parsed: { draft: null } });
    await expect(generator.generate("Just a little background noise")).rejects.toMatchObject({ statusCode: 422, code: "SURVEY_DESCRIPTION_INSUFFICIENT" });
  });

  it.each([
    { status: "incomplete", output_parsed: { draft } },
    { status: "completed", output_parsed: null },
    { status: "completed", output_parsed: { draft: { ...draft, questions: [] } } },
    { status: "completed", output_parsed: { draft: { ...draft, title: "x".repeat(161) } } },
    { status: "completed", output_parsed: { draft: { ...draft, questions: Array.from({ length: 21 }, () => draft.questions[0]) } } },
    { status: "completed", output_parsed: { draft: { ...draft, settings: { publish: true } } } },
  ])("rejects incomplete, refused, or malformed output: %#", async response => {
    parse.mockResolvedValue(response);
    await expect(generator.generate("Ask the team about meetings")).rejects.toThrow();
  });
});
