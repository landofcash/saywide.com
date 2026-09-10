import { AfterModelCallEvent, AfterToolCallEvent, BeforeModelCallEvent, BeforeToolCallEvent, type Agent } from "@strands-agents/sdk";
import { describe, expect, it } from "vitest";
import { registerReportHooks, type ReportHookEvent } from "../src/services/report-hooks.js";

describe("report activity hooks", () => {
  it("records lifecycle outcomes without private tool payloads or errors", async () => {
    const callbacks = new Map<unknown, (event: never) => Promise<void>>();
    const addHook = ((type: unknown, callback: (event: never) => Promise<void>) => {
      callbacks.set(type, callback);
    }) as unknown as Agent["addHook"];
    const events: ReportHookEvent[] = [];
    registerReportHooks({ addHook }, async (event) => { events.push(event); });
    const fire = async (type: unknown, event: unknown = {}) => callbacks.get(type)!(event as never);
    await fire(BeforeModelCallEvent);
    await fire(AfterModelCallEvent, { error: new Error("PRIVATE credential"), stopData: { text: "PRIVATE answer" } });
    const toolUse = { toolUseId: "a", name: "inspect_snapshot", input: { text: "PRIVATE answer" } };
    await fire(BeforeToolCallEvent, { toolUse });
    await fire(AfterToolCallEvent, { toolUse, result: { status: "success", content: "PRIVATE answer" } });
    const other = { toolUseId: "b", name: "PRIVATE tool name" };
    await fire(BeforeToolCallEvent, { toolUse: other });
    await fire(AfterToolCallEvent, { toolUse: other, result: { status: "error" } });
    expect(events.map((event) => event.type)).toEqual(["model_started", "model_failed", "tool_started", "tool_completed", "tool_started", "tool_failed"]);
    expect(events[3]).toMatchObject({ toolName: "inspect_snapshot", durationMs: expect.any(Number) });
    expect(events[5]).toMatchObject({ toolName: "other" });
    expect(JSON.stringify(events)).not.toContain("PRIVATE");
  });
});
