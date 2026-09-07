import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { runner } from "node-pg-migrate";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
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
  awsRegion: "us-east-1",
  transcribeLanguageCode: "en-US",
  transcribeSignedUrlSeconds: 60,
  transcribeRecordingLimitSeconds: 120,
  logLevel: "silent",
};
const app = buildApp({
  config,
  pool,
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
      startedResponseCount: 2,
      submittedResponseCount: 2,
      minReportResponses: 2,
      reportEligible: true,
    });

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
