import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { AuthService } from "../src/services/auth-service.js";
import { SaywideService } from "../src/services/saywide-service.js";
import { SaywideRepository } from "../src/repositories/saywide-repository.js";
import { hashValue } from "../src/security.js";

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://saywide:saywide_dev@127.0.0.1:5433/postgres";
const databaseName = `saywide_auth_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: adminUrl });
const pool = new Pool({ connectionString: databaseUrl.toString() });
const origin = "https://saywide.example";
const config = loadConfig({ NODE_ENV: "production", DATABASE_URL: databaseUrl.toString(), PUBLIC_APP_URL: origin,
  FRONTEND_ORIGINS: origin, TOKEN_DERIVATION_SECRET: "auth-integration-test-secret-at-least-32-characters", LOG_LEVEL: "silent" });
const app = buildApp({ config, pool,
  transcriptionSessionSigner: { async issueSession() { return { websocketUrl: "wss://example.test/transcribe", expiresAt: new Date(Date.now() + 60000).toISOString(), recordingLimitSeconds: 120 }; } },
  surveyTextPolisher: { async polish(input) { return { text: input.text }; } },
  surveyDraftGenerator: { async generate() { return { title: "A draft", introduction: "", questions: [{ prompt: "How was it?", required: true }] }; } },
  reportAnalyzer: { async analyze(snapshot) { return { candidate: { findings: [], limitations: [`${snapshot.responses.length} responses`], followUpQuestions: [] }, usage: {} }; } },
});
const password = "a long test passphrase only";
const draft = { title: "Account ownership test", introduction: "", questions: [{ prompt: "What should improve?", required: true, position: 0 }], settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 } };
let browserNumber = 0;
function browser() {
  const cookies = new Map<string, string>();
  const remoteAddress = `127.1.0.${++browserNumber}`;
  return {
    cookies,
    async send(method: "GET" | "POST" | "PATCH", url: string, payload?: object, requestOrigin = origin) {
      const response = await app.inject({ method, url, remoteAddress, headers: { origin: requestOrigin, cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") }, ...(payload ? { payload } : {}) });
      for (const cookie of response.cookies) { if (cookie.value) cookies.set(cookie.name, cookie.value); else cookies.delete(cookie.name); }
      return response;
    },
  };
}
type Browser = ReturnType<typeof browser>;
async function guest(client: Browser) { expect((await client.send("POST", "/api/organizer/guest-session")).statusCode).toBe(201); }
async function account(client: Browser, email = `${randomUUID()}@example.test`) {
  await guest(client);
  const result = await client.send("POST", "/api/auth/register", { email, password });
  expect(result.statusCode, result.body).toBe(201);
  return email;
}
async function survey(client: Browser) {
  const result = await client.send("POST", "/api/surveys", draft);
  expect(result.statusCode, result.body).toBe(201);
  return result.json<{ surveyId: string }>().surveyId;
}

beforeAll(async () => {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await runner({ databaseUrl: databaseUrl.toString(), dir: fileURLToPath(new URL("../migrations", import.meta.url)), direction: "up", migrationsTable: "pgmigrations", verbose: false });
  await app.ready();
}, 30000);
afterAll(async () => {
  await app.close(); await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
});

describe("organizer accounts", () => {
  it("limits new guest creation without throttling returning workspaces", async () => {
    const client = browser();
    await guest(client);
    const cookie = client.cookies.get("saywide_guest");
    for (let i = 0; i < 12; i++) expect((await client.send("POST", "/api/organizer/guest-session")).statusCode).toBe(200);
    expect(client.cookies.get("saywide_guest")).toBe(cookie);
    for (let i = 0; i < 9; i++) {
      client.cookies.clear();
      expect((await client.send("POST", "/api/organizer/guest-session")).statusCode).toBe(201);
    }
    client.cookies.clear();
    expect((await client.send("POST", "/api/organizer/guest-session")).statusCode).toBe(429);
  });

  it("reads anonymous status without creating a workspace, restores guests, and promotes in place", async () => {
    const client = browser();
    const before = (await pool.query("SELECT count(*) FROM organizer")).rows[0].count;
    const session = await client.send("GET", "/api/auth/session");
    expect(session.json()).toEqual({ workspace: null, guestSurveyCount: 0 });
    expect(session.headers["cache-control"]).toBe("no-store");
    expect((await pool.query("SELECT count(*) FROM organizer")).rows[0].count).toBe(before);
    await guest(client);
    const oldCookie = client.cookies.get("saywide_guest")!;
    expect((await client.send("POST", "/api/organizer/guest-session")).statusCode).toBe(200);
    expect(client.cookies.get("saywide_guest")).toBe(oldCookie);
    const id = await survey(client);
    const owner = (await pool.query("SELECT organizer_id FROM survey WHERE id = $1", [id])).rows[0].organizer_id;
    const email = `${randomUUID()}@example.test`;
    const registered = await client.send("POST", "/api/auth/register", { email: ` ${email.toUpperCase()} `, password });
    expect(registered.statusCode, registered.body).toBe(201);
    expect(client.cookies.has("saywide_guest")).toBe(false);
    const cookie = registered.cookies.find((item) => item.name === "saywide_account")!;
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(cookie).not.toHaveProperty("domain");
    const stored = (await pool.query("SELECT * FROM organizer WHERE id = $1", [owner])).rows[0];
    expect(stored.email).toBe(email);
    expect(stored.password_hash).toMatch(/^\$argon2id\$/);
    expect((await client.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
    const tokenHash = (await pool.query("SELECT token_hash FROM account_session WHERE organizer_id = $1", [owner])).rows[0].token_hash;
    expect(tokenHash.equals(hashValue(client.cookies.get("saywide_account")!))).toBe(true);
    const oldBrowser = browser(); oldBrowser.cookies.set("saywide_guest", oldCookie);
    expect((await oldBrowser.send("GET", `/api/surveys/${id}`)).statusCode).toBe(401);
    const anotherBrowser = browser();
    expect((await anotherBrowser.send("POST", "/api/auth/login", { email, password })).statusCode).toBe(200);
    expect((await anotherBrowser.send("GET", "/api/organizer/surveys")).json().items.map((item: { surveyId: string }) => item.surveyId)).toContain(id);
  });

  it("accepts account sessions for every organizer operation and prevents creating a guest", async () => {
    const client = browser(); await account(client);
    const before = (await pool.query("SELECT count(*) FROM organizer")).rows[0].count;
    expect((await client.send("POST", "/api/organizer/guest-session")).json().workspace.kind).toBe("registered");
    expect(client.cookies.has("saywide_guest")).toBe(false);
    expect((await pool.query("SELECT count(*) FROM organizer")).rows[0].count).toBe(before);
    const id = await survey(client);
    expect((await client.send("PATCH", `/api/surveys/${id}`, { title: "Edited by account" })).statusCode).toBe(200);
    for (const action of ["publish", "close", "reopen"]) expect((await client.send("POST", `/api/surveys/${id}/${action}`, action === "reopen" ? {} : undefined)).statusCode).toBe(200);
    expect((await client.send("GET", `/api/surveys/${id}/summary`)).statusCode).toBe(200);
    expect((await client.send("GET", `/api/surveys/${id}/reports`)).statusCode).toBe(200);
    expect((await client.send("POST", `/api/surveys/${id}/reports`, { instruction: "Summarize all useful patterns" })).json().error.code).toBe("TOO_FEW_RESPONSES");
    expect((await client.send("POST", "/api/organizer/transcription-sessions")).statusCode).toBe(200);
    expect((await client.send("POST", "/api/organizer/polish-text", { field: "title", text: "Test title" })).statusCode).toBe(200);
    expect((await client.send("POST", "/api/organizer/draft-survey", { transcript: "Ask the team how things went this week" })).statusCode).toBe(200);
  });

  it("keeps guest work on duplicate registration and uses generic login failures", async () => {
    const owner = browser(); const email = await account(owner);
    const client = browser(); await guest(client); const id = await survey(client);
    const duplicate = await client.send("POST", "/api/auth/register", { email, password });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("REGISTRATION_REQUIRES_SIGN_IN");
    expect((await client.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
    const wrong = await client.send("POST", "/api/auth/login", { email, password: "wrong" });
    const missing = await client.send("POST", "/api/auth/login", { email: `${randomUUID()}@example.test`, password: "wrong" });
    expect(wrong.statusCode).toBe(401); expect(missing.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(missing.json().error.message);
    expect(client.cookies.has("saywide_guest")).toBe(true);
  });

  it("requires explicit claiming, gives accounts precedence, and preserves links, answers and reports", async () => {
    const owner = browser(); const email = await account(owner); const ownedId = await survey(owner);
    const client = browser(); await guest(client); const id = await survey(client);
    const oldGuest = client.cookies.get("saywide_guest")!;
    const published = await client.send("POST", `/api/surveys/${id}/publish`);
    const publicToken = published.json().publicToken;
    const publicSurvey = (await client.send("GET", `/api/public/s/${publicToken}`)).json();
    for (let i = 0; i < 2; i++) {
      const started = (await client.send("POST", `/api/public/s/${publicToken}/sessions`, { consentVersion: publicSurvey.consentVersion })).json();
      const headers = { authorization: `Bearer ${started.sessionToken}` };
      expect((await app.inject({ method: "PUT", url: `/api/public/sessions/${started.sessionId}/answers/${publicSurvey.questions[0].questionId}`, headers, payload: { finalText: "Improve the meeting agenda", inputMode: "text", audioStatus: "not_used" } })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: `/api/public/sessions/${started.sessionId}/submit`, headers, payload: { consentVersion: publicSurvey.consentVersion } })).statusCode).toBe(200);
    }
    const report = await client.send("POST", `/api/surveys/${id}/reports`, { instruction: "Summarize the feedback patterns" });
    expect(report.statusCode, report.body).toBe(202);
    const reportId = report.json().reportId;
    for (let i = 0; i < 100; i++) {
      const result = (await client.send("GET", `/api/reports/${reportId}`)).json();
      if (["completed", "failed"].includes(result.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const loggedIn = await client.send("POST", "/api/auth/login", { email, password });
    expect(loggedIn.json().guestWorkspacePending).toBe(true);
    expect((await client.send("GET", "/api/auth/session")).json().guestSurveyCount).toBe(1);
    expect((await client.send("GET", `/api/surveys/${ownedId}`)).statusCode).toBe(200);
    expect((await client.send("GET", `/api/surveys/${id}`)).statusCode).toBe(404);
    expect((await client.send("POST", "/api/auth/claim-guest", { confirm: false })).statusCode).toBe(422);
    const stillGuest = browser(); stillGuest.cookies.set("saywide_guest", oldGuest);
    expect((await stillGuest.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
    const claimed = await client.send("POST", "/api/auth/claim-guest", { confirm: true });
    expect(claimed.json()).toEqual({ transferredSurveyCount: 1 });
    expect((await client.send("GET", `/api/surveys/${id}`)).json()).toMatchObject({ publicToken, submittedResponseCount: 2 });
    expect((await client.send("GET", `/api/reports/${reportId}`)).statusCode).toBe(200);
    expect((await client.send("GET", `/api/public/s/${publicToken}`)).statusCode).toBe(200);
    expect((await stillGuest.send("GET", `/api/surveys/${id}`)).statusCode).toBe(401);
    expect((await client.send("POST", "/api/auth/claim-guest", { confirm: true })).statusCode).toBe(409);
  });

  it("rotates and expires account sessions, and logs out without deleting guest work", async () => {
    const client = browser(); const email = await account(client); const oldToken = client.cookies.get("saywide_account")!;
    await client.send("POST", "/api/auth/login", { email, password });
    expect(client.cookies.get("saywide_account")).not.toBe(oldToken);
    const revoked = browser(); revoked.cookies.set("saywide_account", oldToken);
    expect((await revoked.send("GET", "/api/organizer/surveys")).statusCode).toBe(401);
    const guestBrowser = browser(); await guest(guestBrowser); const id = await survey(guestBrowser);
    await guestBrowser.send("POST", "/api/auth/login", { email, password });
    const out = await guestBrowser.send("POST", "/api/auth/logout");
    expect(out.statusCode).toBe(204); expect(out.body).toBe("");
    expect((await guestBrowser.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
    expect((await guestBrowser.send("POST", "/api/auth/logout")).statusCode).toBe(204);
    await pool.query("UPDATE account_session SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [hashValue(client.cookies.get("saywide_account")!)]);
    expect((await client.send("GET", "/api/auth/session")).json().workspace).toBeNull();
    expect((await client.send("GET", "/api/organizer/surveys")).statusCode).toBe(401);
  });

  it("rejects untrusted origins, invalid passwords and excessive attempts", async () => {
    const client = browser(); await guest(client);
    for (const path of ["register", "login", "claim-guest", "logout"]) {
      const payload = path === "claim-guest" ? { confirm: true } : path === "logout" ? undefined : { email: "test@example.test", password };
      expect((await client.send("POST", `/api/auth/${path}`, payload, "https://untrusted.example")).statusCode).toBe(403);
    }
    expect((await client.send("POST", "/api/auth/register", { email: "test@example.test", password: "short" })).statusCode).toBe(400);
    const email = `${randomUUID()}@example.test`;
    for (let i = 0; i < 10; i++) expect((await client.send("POST", "/api/auth/login", { email, password })).statusCode).toBe(401);
    expect((await client.send("POST", "/api/auth/login", { email, password })).statusCode).toBe(429);
    for (let i = 0; i < 20; i++) await client.send("POST", "/api/auth/login", { email: `${randomUUID()}@example.test`, password });
    expect((await client.send("POST", "/api/auth/login", { email, password })).statusCode).toBe(429);
  });

  it("rolls back a failed claim without revoking the guest credential", async () => {
    const owner = browser(); const email = await account(owner);
    const client = browser(); await guest(client); const id = await survey(client);
    await client.send("POST", "/api/auth/login", { email, password });
    await pool.query(`CREATE FUNCTION reject_test_transfer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF OLD.id = '${id}'::uuid AND NEW.organizer_id <> OLD.organizer_id THEN RAISE EXCEPTION 'simulated failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_transfer BEFORE UPDATE ON survey FOR EACH ROW EXECUTE FUNCTION reject_test_transfer();`);
    try {
      expect((await client.send("POST", "/api/auth/claim-guest", { confirm: true })).statusCode).toBe(500);
      const guestOnly = browser(); guestOnly.cookies.set("saywide_guest", client.cookies.get("saywide_guest")!);
      expect((await guestOnly.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
      expect((await client.send("GET", "/api/auth/session")).json().guestSurveyCount).toBe(1);
    } finally { await pool.query("DROP TRIGGER reject_test_transfer ON survey; DROP FUNCTION reject_test_transfer()"); }
  });

  it("rejects a stale guest write after a claim instead of stranding a survey", async () => {
    const owner = browser(); const email = await account(owner);
    const client = browser(); await guest(client); const id = await survey(client);
    const auth = new AuthService(pool, config);
    const staleAccess = await auth.requireOrganizer(Object.fromEntries(client.cookies));
    const service = new SaywideService(new SaywideRepository(pool), config, auth);
    await client.send("POST", "/api/auth/login", { email, password });
    expect((await client.send("POST", "/api/auth/claim-guest", { confirm: true })).statusCode).toBe(200);
    await expect(service.createSurvey(staleAccess.organizerId, draft, undefined, staleAccess)).rejects.toMatchObject({ statusCode: 401 });
    expect((await pool.query("SELECT count(*) FROM survey WHERE organizer_id = $1", [staleAccess.organizerId])).rows[0].count).toBe("0");
    expect((await client.send("GET", `/api/surveys/${id}`)).statusCode).toBe(200);
  });

  it("waits for an in-flight guest creation and includes it in the transfer", async () => {
    const owner = browser(); const email = await account(owner);
    const client = browser(); await guest(client);
    const auth = new AuthService(pool, config);
    const access = await auth.requireOrganizer(Object.fromEntries(client.cookies));
    let inserted!: () => void;
    let release!: () => void;
    const insertedGate = new Promise<void>((resolve) => { inserted = resolve; });
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    class PausingRepository extends SaywideRepository {
      override async createSurvey(...args: Parameters<SaywideRepository["createSurvey"]>) {
        await super.createSurvey(...args);
        inserted();
        await releaseGate;
      }
    }
    const service = new SaywideService(new PausingRepository(pool), config, auth);
    const creation = service.createSurvey(access.organizerId, draft, undefined, access);
    await insertedGate;
    await client.send("POST", "/api/auth/login", { email, password });
    const claiming = auth.claim(Object.fromEntries(client.cookies), true);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const locks = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%ORDER BY id FOR UPDATE%'");
        if (locks.rowCount) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    } finally { release(); }
    const [created, claimed] = await Promise.all([creation, claiming]);
    expect(claimed.transferredSurveyCount).toBe(1);
    expect((await client.send("GET", `/api/surveys/${created.surveyId}`)).statusCode).toBe(200);
    expect((await pool.query("SELECT count(*) FROM survey WHERE organizer_id = $1", [access.organizerId])).rows[0].count).toBe("0");
  });
});
