import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { runner } from "node-pg-migrate";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadReportSkills } from "../src/agents/skill-catalogue.js";
import type { AppConfig } from "../src/config.js";

const adminDatabaseUrl = process.env.TEST_DATABASE_ADMIN_URL
  ?? "postgres://saywide:saywide_dev@127.0.0.1:5433/postgres";
const databaseName = `saywide_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = new URL(adminDatabaseUrl);
testDatabaseUrl.pathname = `/${databaseName}`;

const adminPool = new Pool({ connectionString: adminDatabaseUrl });
const pool = new Pool({ connectionString: testDatabaseUrl.toString() });
const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 4000,
  databaseUrl: testDatabaseUrl.toString(),
  publicAppUrl: "http://localhost:3000",
  frontendOrigins: ["http://localhost:3000"],
  tokenDerivationSecret: "test-only-derivation-secret-with-32-characters",
  guestCredentialDays: 365,
  responseSessionMinutes: 60,
  modelProvider: "openai",
  openAiModelId: "gpt-5.6-luna",
  reportMaxResponses: 30,
  awsRegion: "us-east-1",
  bedrockModelId: "amazon.nova-micro-v1:0",
  transcribeLanguageCode: "en-US",
  transcribeSignedUrlSeconds: 60,
  transcribeRecordingLimitSeconds: 120,
  logLevel: "silent",
};
const app = buildApp({
  config,
  pool,
  surveyTextPolisher: {
    async polish(input) {
      if (input.text === "simulate provider failure") throw new Error("provider-secret-must-not-leak");
      return { text: input.field === "title" ? "Team feedback" : input.field === "question" ? "How could we improve our team meetings?" : "Share your thoughts on our meetings." };
    },
  },
  reportAnalyzer: {
    async analyze(snapshot, _instruction, activity) {
      const { manifest } = await loadReportSkills();
      await activity?.({ type: "skills_available", skills: manifest, deploymentRevision: "abcdef1234567" });
      for (const skill of manifest) await activity?.({ type: "skill_activated", skill });
      await activity?.({ type: "model_started" });
      await Promise.all([
        activity?.({ type: "tool_started", toolName: "inspect_snapshot" }),
        activity?.({ type: "tool_started", toolName: "other" }),
      ]);
      await activity?.({ type: "model_completed", durationMs: 12 });
      const [first, second] = snapshot.responses;
      const firstAnswer = first.answers[0];
      return {
        candidate: {
          findings: [
            {
              title: "A shared pattern",
              category: "opportunity",
              summary: "Both submitted sessions support the same practical theme.",
              suggestedAction: "Test one small improvement with the group.",
              assignments: [first, second].map((response) => ({
                responseSessionId: response.responseSessionId,
                questionId: response.answers[0].questionId,
                reason: "The answer directly supports this theme.",
              })),
              evidence: [{ answerId: firstAnswer.answerId, excerpt: firstAnswer.text }],
            },
            {
              title: "Invalid references are removed",
              category: "friction",
              summary: "This finding must not be persisted.",
              suggestedAction: "Do not show this.",
              assignments: [{ responseSessionId: randomUUID(), questionId: randomUUID(), reason: "Invented references." }],
              evidence: [{ answerId: randomUUID(), excerpt: "Invented evidence." }],
            },
          ],
          limitations: ["This is a synthetic integration fixture."],
          followUpQuestions: ["What should we test next?"],
        },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
    },
  },
  transcriptionSessionSigner: {
    async issueSession() {
      return {
        websocketUrl: "wss://transcribestreaming.us-east-1.amazonaws.com:8443/stream-transcription-websocket?signed=test",
        expiresAt: "2026-09-07T12:01:00.000Z",
        recordingLimitSeconds: 120,
      };
    },
  },
});

beforeAll(async () => {
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  await runner({
    databaseUrl: testDatabaseUrl.toString(),
    dir: fileURLToPath(new URL("../migrations", import.meta.url)),
    direction: "up",
    migrationsTable: "pgmigrations",
    verbose: false,
  });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await runner({
    databaseUrl: testDatabaseUrl.toString(),
    dir: fileURLToPath(new URL("../migrations", import.meta.url)),
    direction: "down",
    migrationsTable: "pgmigrations",
    verbose: false,
  });
  await adminPool.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
  await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await adminPool.end();
});

describe("Phase 1 API", () => {
  it("creates, edits, and publishes surveys with more than five questions", async () => {
    const origin = "http://localhost:3000";
    const guest = await app.inject({ method: "POST", url: "/api/organizer/guest-session", headers: { origin } });
    const cookie = guest.headers["set-cookie"]!.toString().split(";")[0];
    const headers = { origin, cookie };
    const draft = {
      title: "Longer survey", introduction: "Share your feedback.",
      questions: Array.from({ length: 8 }, (_, position) => ({ prompt: `What are your thoughts on topic ${position + 1}?`, required: true, position })),
      settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 },
    };
    const created = await app.inject({ method: "POST", url: "/api/surveys", headers, payload: draft });
    expect(created.statusCode).toBe(201);
    const id = created.json().surveyId;
    expect(created.json().questions).toHaveLength(8);
    draft.questions.push({ prompt: "What else should we know?", required: false, position: 8 });
    const updated = await app.inject({ method: "PATCH", url: `/api/surveys/${id}`, headers, payload: draft });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().questions).toHaveLength(9);
    const published = await app.inject({ method: "POST", url: `/api/surveys/${id}/publish`, headers });
    expect(published.statusCode).toBe(200);
    const visible = await app.inject({ method: "GET", url: `/api/public/s/${published.json().publicToken}` });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().questions.map((question: { position: number }) => question.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // Remove this disposable fixture before testing rollback to the old five-question schema.
    await pool.query("DELETE FROM survey WHERE id = $1", [id]);
  });

  it("protects organizer writing tools and returns suggestions without saving a survey", async () => {
    const origin = "http://localhost:3000";
    const guest = await app.inject({ method: "POST", url: "/api/organizer/guest-session", headers: { origin } });
    const cookie = guest.headers["set-cookie"]!.toString().split(";")[0];
    const headers = { origin, cookie };
    const before = await pool.query("SELECT count(*) FROM survey");
    for (const url of ["/api/organizer/transcription-sessions", "/api/organizer/polish-text"]) {
      const payload = url.endsWith("polish-text") ? { field: "title", text: "um team feedback" } : undefined;
      const wrongOrigin = await app.inject({ method: "POST", url, headers: { ...headers, origin: "https://untrusted.example" }, payload });
      expect(wrongOrigin.statusCode).toBe(403);
      const noGuest = await app.inject({ method: "POST", url, headers: { origin }, payload });
      expect(noGuest.statusCode).toBe(401);
    }
    const voice = await app.inject({ method: "POST", url: "/api/organizer/transcription-sessions", headers });
    expect(voice.statusCode).toBe(200);
    expect(voice.json().websocketUrl).toMatch(/^wss:/);
    expect(voice.headers["cache-control"]).toContain("no-store");
    const polish = (payload: unknown) => app.inject({ method: "POST", url: "/api/organizer/polish-text", headers, payload });
    const result = await polish({ field: "title", text: "um team feedback" });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ text: "Team feedback" });
    expect(result.headers["cache-control"]).toContain("no-store");
    expect((await polish({ field: "introduction", text: "um share thoughts about meetings" })).json())
      .toEqual({ text: "Share your thoughts on our meetings." });
    const question = await polish({ field: "question", text: "um how could we make meetings better" });
    expect(question.statusCode).toBe(200);
    expect(question.json()).toEqual({ text: "How could we improve our team meetings?" });
    for (const invalid of [
      { field: "expiresAt", text: "Friday" },
      { field: "title", text: " " },
      { field: "title", text: "x".repeat(2001) },
      { field: "title", text: "Hello", expiresAt: "2026-10-01" },
    ]) expect((await polish(invalid)).statusCode).toBe(400);
    const failure = await polish({ field: "title", text: "simulate provider failure" });
    expect(failure.statusCode).toBe(503);
    expect(failure.body).not.toContain("provider-secret");
    expect(failure.json().error.code).toBe("POLISH_UNAVAILABLE");
    expect((await pool.query("SELECT count(*) FROM survey")).rows).toEqual(before.rows);
  });

  it("permits the browser preflight needed for text autosave", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: `/api/public/sessions/${randomUUID()}/answers/${randomUUID()}`,
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("runs the anonymous text response flow and preserves idempotency", async () => {
    const origin = "http://localhost:3000";
    const guest = await app.inject({ method: "POST", url: "/api/organizer/guest-session", headers: { origin } });
    expect(guest.statusCode).toBe(201);
    expect(guest.json().workspace).toMatchObject({ kind: "guest", recoveryRisk: "browser-bound" });
    const cookie = guest.headers["set-cookie"]?.toString().split(";")[0];
    expect(cookie).toContain("saywide_guest=");

    const draft = {
      title: "Quarterly team reflection",
      introduction: "Tell us what helped and what should change.",
      questions: [
        { prompt: "What worked well?", required: true, position: 0 },
        { prompt: "What should we change?", required: true, position: 1 },
      ],
      settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 },
    };
    const createHeaders = { origin, cookie: cookie!, "idempotency-key": "create-quarterly-reflection" };
    const created = await app.inject({ method: "POST", url: "/api/surveys", headers: createHeaders, payload: draft });
    expect(created.statusCode).toBe(201);
    const survey = created.json();
    expect(survey).toMatchObject({ status: "draft", title: draft.title, publicToken: null });
    expect(survey.questions).toHaveLength(2);

    const createRetry = await app.inject({ method: "POST", url: "/api/surveys", headers: createHeaders, payload: draft });
    expect(createRetry.statusCode).toBe(201);
    expect(createRetry.json().surveyId).toBe(survey.surveyId);

    const published = await app.inject({
      method: "POST",
      url: `/api/surveys/${survey.surveyId}/publish`,
      headers: { origin, cookie: cookie! },
    });
    expect(published.statusCode).toBe(200);
    const { publicToken } = published.json();

    const prematureReport = await app.inject({
      method: "POST",
      url: `/api/surveys/${survey.surveyId}/reports`,
      headers: { origin, cookie: cookie! },
      payload: { instruction: "Find the most important patterns in these responses." },
    });
    expect(prematureReport.statusCode).toBe(422);
    expect(prematureReport.json().error.code).toBe("TOO_FEW_RESPONSES");

    const publicSurvey = await app.inject({ method: "GET", url: `/api/public/s/${publicToken}` });
    expect(publicSurvey.statusCode).toBe(200);
    const publicBody = publicSurvey.json();
    expect(publicBody).not.toHaveProperty("submittedResponseCount");

    const firstStartHeaders = { "idempotency-key": "response-one" };
    const firstStart = await app.inject({
      method: "POST",
      url: `/api/public/s/${publicToken}/sessions`,
      headers: firstStartHeaders,
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(firstStart.statusCode).toBe(201);
    const firstSession = firstStart.json();

    const transcriptionSession = await app.inject({
      method: "POST",
      url: `/api/public/sessions/${firstSession.sessionId}/transcription-sessions`,
      headers: { origin, authorization: `Bearer ${firstSession.sessionToken}` },
      payload: {
        questionId: publicBody.questions[0].questionId,
        languageCode: "en-US",
        mediaEncoding: "pcm",
        sampleRateHertz: 16000,
      },
    });
    expect(transcriptionSession.statusCode).toBe(200);
    expect(transcriptionSession.headers["cache-control"]).toBe("private, no-store");
    expect(transcriptionSession.json()).toMatchObject({
      websocketUrl: expect.stringMatching(/^wss:\/\//),
      recordingLimitSeconds: 120,
    });

    const firstStartRetry = await app.inject({
      method: "POST",
      url: `/api/public/s/${publicToken}/sessions`,
      headers: firstStartHeaders,
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(firstStartRetry.json()).toEqual(firstSession);

    const secondStart = await app.inject({
      method: "POST",
      url: `/api/public/s/${publicToken}/sessions`,
      headers: { "idempotency-key": "response-two" },
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(secondStart.statusCode).toBe(201);
    const secondSession = secondStart.json();

    const thirdStart = await app.inject({
      method: "POST",
      url: `/api/public/s/${publicToken}/sessions`,
      headers: { "idempotency-key": "response-three" },
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(thirdStart.statusCode).toBe(201);
    const thirdSession = thirdStart.json();

    const closed = await app.inject({
      method: "POST",
      url: `/api/surveys/${survey.surveyId}/close`,
      headers: { origin, cookie: cookie! },
    });
    expect(closed.statusCode).toBe(200);

    for (const session of [firstSession, secondSession]) {
      for (const [index, question] of publicBody.questions.entries()) {
        const saved = await app.inject({
          method: "PUT",
          url: `/api/public/sessions/${session.sessionId}/answers/${question.questionId}`,
          headers: { authorization: `Bearer ${session.sessionToken}` },
          payload: { finalText: `Response ${index + 1}`, inputMode: "text", audioStatus: "not_used" },
        });
        expect(saved.statusCode).toBe(200);
      }
      const submitted = await app.inject({
        method: "POST",
        url: `/api/public/sessions/${session.sessionId}/submit`,
        headers: { authorization: `Bearer ${session.sessionToken}` },
        payload: { consentVersion: publicBody.consentVersion },
      });
      expect(submitted.statusCode).toBe(200);
      expect(submitted.json()).toMatchObject({ submitted: true });
    }

    const newSessionAfterClose = await app.inject({
      method: "POST",
      url: `/api/public/s/${publicToken}/sessions`,
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(newSessionAfterClose.statusCode).toBe(409);
    expect(newSessionAfterClose.json().error.code).toBe("SURVEY_CLOSED");

    const summary = await app.inject({
      method: "GET",
      url: `/api/surveys/${survey.surveyId}/summary`,
      headers: { cookie: cookie! },
    });
    expect(summary.json()).toMatchObject({
      startedResponseCount: 3,
      submittedResponseCount: 2,
      minReportResponses: 2,
      reportEligible: true,
    });

    const acceptedReport = await app.inject({
      method: "POST",
      url: `/api/surveys/${survey.surveyId}/reports`,
      headers: { origin, cookie: cookie!, "idempotency-key": "report-quarterly-reflection" },
      payload: { instruction: "Find the most important patterns and suggest a practical next step." },
    });
    expect(acceptedReport.statusCode, acceptedReport.body).toBe(202);
    expect(acceptedReport.json()).toMatchObject({ status: "queued" });
    const reportId = acceptedReport.json().reportId as string;

    const acceptedReportRetry = await app.inject({
      method: "POST",
      url: `/api/surveys/${survey.surveyId}/reports`,
      headers: { origin, cookie: cookie!, "idempotency-key": "report-quarterly-reflection" },
      payload: { instruction: "Find the most important patterns and suggest a practical next step." },
    });
    expect(acceptedReportRetry.statusCode).toBe(202);
    expect(acceptedReportRetry.json().reportId).toBe(reportId);

    for (const [index, question] of publicBody.questions.entries()) {
      const saved = await app.inject({
        method: "PUT",
        url: `/api/public/sessions/${thirdSession.sessionId}/answers/${question.questionId}`,
        headers: { authorization: `Bearer ${thirdSession.sessionToken}` },
        payload: { finalText: `Late response ${index + 1}`, inputMode: "text", audioStatus: "not_used" },
      });
      expect(saved.statusCode).toBe(200);
    }
    const lateSubmission = await app.inject({
      method: "POST",
      url: `/api/public/sessions/${thirdSession.sessionId}/submit`,
      headers: { authorization: `Bearer ${thirdSession.sessionToken}` },
      payload: { consentVersion: publicBody.consentVersion },
    });
    expect(lateSubmission.statusCode).toBe(200);

    let reportResult: ReturnType<typeof acceptedReport.json> | undefined;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await app.inject({ method: "GET", url: `/api/reports/${reportId}`, headers: { cookie: cookie! } });
      expect(response.statusCode).toBe(200);
      reportResult = response.json();
      if (reportResult.status === "completed" || reportResult.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(reportResult).toMatchObject({
      status: "completed",
      report: {
        reportId,
        eligibleResponseCount: 2,
        markdown: expect.stringContaining("### Evidence"),
        findings: [{ supportCount: 2, supportPercentage: 100, confidence: "medium" }],
      },
    });
    expect(reportResult.report.findings).toHaveLength(1);
    expect(reportResult.activity).toHaveLength(13);
    expect(reportResult.activity[4]).toMatchObject({ source: "agent", label: "Loaded feedback synthesis guidance" });
    expect(reportResult.activity[5]).toMatchObject({ source: "agent", label: "Loaded evidence review guidance" });
    expect(reportResult.activity[6]).toMatchObject({ sequence: 7, source: "agent", type: "model_started" });
    expect(reportResult.activity[9]).toMatchObject({ source: "agent", durationMs: 12 });
    expect(reportResult.activity[12]).toMatchObject({ source: "workflow", type: "completed" });
    expect(JSON.stringify(reportResult.activity)).not.toContain("answerId");
    expect(JSON.stringify(reportResult.activity)).not.toContain("safe_metadata");

    const trace = await pool.query<{ event_type: string; tool_name: string | null }>(`
      SELECT ae.event_type, ae.tool_name
      FROM agent_event ae JOIN agent_run ar ON ar.id = ae.agent_run_id
      WHERE ar.report_request_id = $1 ORDER BY ae.sequence
    `, [reportId]);
    expect(trace.rows.map((row) => row.event_type)).toEqual([
      "queued", "snapshot_started", "snapshot_loaded", "skills_available", "skill_activated", "skill_activated", "model_started", "tool_started", "tool_started", "model_completed", "themes_extracted", "evidence_validated", "completed",
    ]);
    const catalogueEvent = await pool.query(`
      SELECT safe_metadata FROM agent_event ae JOIN agent_run ar ON ar.id = ae.agent_run_id
      WHERE ar.report_request_id = $1 AND ae.event_type = 'skills_available'
    `, [reportId]);
    const { manifest } = await loadReportSkills();
    expect(catalogueEvent.rows[0].safe_metadata).toEqual({ skills: manifest, deploymentRevision: "abcdef1234567" });

    const assignments = await pool.query<{ validated: boolean }>(`
      SELECT ta.validated FROM theme_assignment ta
      JOIN finding f ON f.id = ta.finding_id
      JOIN report r ON r.id = f.report_id
      WHERE r.report_request_id = $1
    `, [reportId]);
    expect(assignments.rows).toHaveLength(2);
    expect(assignments.rows.every((row) => row.validated)).toBe(true);

    const strangerGuest = await app.inject({ method: "POST", url: "/api/organizer/guest-session", headers: { origin } });
    const strangerCookie = strangerGuest.headers["set-cookie"]?.toString().split(";")[0];
    const unownedReport = await app.inject({
      method: "GET",
      url: `/api/reports/${reportId}`,
      headers: { cookie: strangerCookie! },
    });
    expect(unownedReport.statusCode).toBe(404);
    expect(unownedReport.json().error.code).toBe("REPORT_NOT_FOUND");

    const storedToken = await pool.query<{ session_token_hash: Buffer }>(
      "SELECT session_token_hash FROM response_session WHERE client_session_id = $1",
      [firstSession.sessionId],
    );
    expect(storedToken.rows[0].session_token_hash.toString("utf8")).not.toBe(firstSession.sessionToken);

    await expect(pool.query("DELETE FROM survey WHERE id = $1", [survey.surveyId])).resolves.toMatchObject({ rowCount: 1 });
    const remainingAnswers = await pool.query("SELECT 1 FROM answer WHERE response_session_id IN (SELECT id FROM response_session WHERE survey_id = $1)", [survey.surveyId]);
    expect(remainingAnswers.rowCount).toBe(0);
  });

  it("rejects organizer mutations without the browser origin and guest cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/surveys",
      payload: {
        title: "Blocked",
        introduction: "",
        questions: [{ prompt: "Question", required: true, position: 0 }],
        settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 },
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
});
