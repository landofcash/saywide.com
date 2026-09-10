import { Agent, BedrockModel, type ModelStreamEvent } from "@strands-agents/sdk";
import { describe, expect, it, vi } from "vitest";
import { hashSkillFiles, loadReportSkills } from "../src/agents/skill-catalogue.js";
import { registerReportHooks, type ReportHookEvent } from "../src/services/report-hooks.js";

describe("repository-owned skills", () => {
  it("loads strict skill definitions and hashes instructions plus examples", async () => {
    const { manifest } = await loadReportSkills();
    expect(manifest.map((skill) => skill.id)).toEqual(["feedback-synthesis", "evidence-review"]);
    for (const skill of manifest) {
      expect(skill.version).toBe("1.0.0");
      expect(skill.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
    const files: Array<[string, string]> = [["SKILL.md", "instructions\r\n"], ["examples.md", "example"]];
    expect(hashSkillFiles(files)).toBe(hashSkillFiles([["SKILL.md", "instructions\n"], ["examples.md", "example"]]));
    expect(hashSkillFiles(files)).not.toBe(hashSkillFiles([["SKILL.md", "instructions\n"], ["examples.md", "changed example"]]));
    expect(hashSkillFiles(files)).not.toBe(hashSkillFiles([["SKILL.md", "instructions\n"], ["renamed.md", "example"]]));
  });

  it("activates real SDK skills with bundled examples and records only confirmed activations", async () => {
    const { plugin, manifest } = await loadReportSkills();
    const model = new BedrockModel({ modelId: "unused-no-model-call" });
    const requests = ["feedback-synthesis", "feedback-synthesis", "PRIVATE unknown skill", "evidence-review"];
    let call = 0;
    vi.spyOn(model, "stream").mockImplementation(async function* (): AsyncGenerator<ModelStreamEvent> {
      const skillName = requests[call++];
      yield { type: "modelMessageStartEvent", role: "assistant" };
      if (skillName) {
        yield { type: "modelContentBlockStartEvent", start: { type: "toolUseStart", name: "skills", toolUseId: `call-${call}` } };
        yield { type: "modelContentBlockDeltaEvent", delta: { type: "toolUseInputDelta", input: JSON.stringify({ skill_name: skillName }) } };
      } else {
        yield { type: "modelContentBlockStartEvent" };
        yield { type: "modelContentBlockDeltaEvent", delta: { type: "textDelta", text: "Done" } };
      }
      yield { type: "modelContentBlockStopEvent" };
      yield { type: "modelMessageStopEvent", stopReason: skillName ? "toolUse" : "endTurn" };
    });
    const agent = new Agent({ model, plugins: [plugin], printer: false });
    const events: ReportHookEvent[] = [];
    registerReportHooks(agent, async (event) => { events.push(event); }, { manifest, activated: () => plugin.getActivatedSkills(agent) });
    await agent.initialize();
    expect(plugin.getActivatedSkills(agent)).toEqual([]);
    await agent.invoke("Test skill loading with synthetic responses");
    expect(JSON.stringify(agent.messages)).toContain("Synthetic examples");
    expect(plugin.getActivatedSkills(agent)).toEqual(["feedback-synthesis", "evidence-review"]);
    expect(events.filter((event) => event.type === "skill_activated")).toEqual(manifest.map((skill) => ({ type: "skill_activated", skill })));
    expect(JSON.stringify(events)).not.toContain("PRIVATE");
    expect(JSON.stringify(events)).not.toContain("Synthetic examples");
  });
});
