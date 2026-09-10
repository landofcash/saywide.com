import { AfterModelCallEvent, AfterToolCallEvent, BeforeModelCallEvent, BeforeToolCallEvent, type Agent } from "@strands-agents/sdk";
import type { SkillVersion } from "../agents/skill-catalogue.js";

export type ReportHookEvent = {
  type: "model_started" | "model_completed" | "model_failed" | "tool_started" | "tool_completed" | "tool_failed";
  toolName?: "inspect_snapshot" | "skills" | "other";
  durationMs?: number;
} | { type: "skills_available"; skills: SkillVersion[]; deploymentRevision: string | null }
  | { type: "skill_activated"; skill: SkillVersion };
export type ReportActivitySink = (event: ReportHookEvent) => Promise<void>;

/** Only allowlisted operational metadata crosses this boundary, never SDK payloads. */
export function registerReportHooks(agent: Pick<Agent, "addHook">, emit: ReportActivitySink,
  skillContext?: { manifest: SkillVersion[]; activated: () => readonly string[] }) {
  let modelStarted = 0;
  const tools = new Map<string, number>();
  const reportedSkills = new Set<string>();
  const safeToolName = (name: string) => name === "inspect_snapshot" || name === "skills" ? name : "other";
  agent.addHook(BeforeModelCallEvent, async () => {
    modelStarted = performance.now();
    await emit({ type: "model_started" });
  });
  agent.addHook(AfterModelCallEvent, async (event) => {
    await emit({ type: event.error ? "model_failed" : "model_completed", durationMs: Math.round(performance.now() - modelStarted) });
  });
  agent.addHook(BeforeToolCallEvent, async (event) => {
    tools.set(event.toolUse.toolUseId, performance.now());
    await emit({ type: "tool_started", toolName: safeToolName(event.toolUse.name) });
  });
  agent.addHook(AfterToolCallEvent, async (event) => {
    const started = tools.get(event.toolUse.toolUseId);
    tools.delete(event.toolUse.toolUseId);
    await emit({
      type: event.error || event.result.status === "error" ? "tool_failed" : "tool_completed",
      toolName: safeToolName(event.toolUse.name),
      ...(started === undefined ? {} : { durationMs: Math.round(performance.now() - started) }),
    });
    // Read confirmed plugin state, not model-supplied skill_name or tool output text.
    if (event.toolUse.name === "skills" && !event.error && event.result.status !== "error" && skillContext) {
      for (const id of skillContext.activated()) {
        const skill = skillContext.manifest.find((entry) => entry.id === id);
        if (!skill || reportedSkills.has(id)) continue;
        reportedSkills.add(id);
        await emit({ type: "skill_activated", skill });
      }
    }
  });
}
