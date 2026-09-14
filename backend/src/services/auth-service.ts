import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import type { OrganizerSession } from "@saywide/contracts";
import type { Pool, PoolClient } from "pg";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { ACCOUNT_COOKIE, GUEST_COOKIE } from "../routes/helpers.js";
import { addDays, createBearerToken, hashValue } from "../security.js";

type Cookies = Record<string, string | undefined>;
type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;
interface Identity {
  organizer_id: string;
  kind: "guest" | "registered";
  email: string | null;
  created_at: Date;
}
export interface OrganizerAccess {
  organizerId: string;
  kind: "guest" | "registered";
  credentialHash: Buffer;
}
const authRequired = () => new AppError(401, "ORGANIZER_AUTH_REQUIRED", "Please sign in or continue as guest.");

// Guest promotion/claim and guest writes use the same organizer-row lock.
// Recheck the credential after obtaining the lock: a request may have waited for a claim.
export async function lockOrganizerAccess(db: Queryable, access: OrganizerAccess): Promise<void> {
  await db.query("SELECT id FROM organizer WHERE id = $1 FOR SHARE", [access.organizerId]);
  const table = access.kind === "registered" ? "account_session" : "organizer_credential";
  const result = await db.query(`
    SELECT 1 FROM organizer o JOIN ${table} c ON c.organizer_id = o.id
    WHERE o.id = $1 AND o.kind = $2 AND o.status = 'active'
      AND c.token_hash = $3 AND c.revoked_at IS NULL AND c.expires_at > now()
  `, [access.organizerId, access.kind, access.credentialHash]);
  if (!result.rowCount) throw authRequired();
}

export class AuthService {
  private dummyHash?: Promise<string>;
  private readonly failedLogins = new Map<string, { count: number; until: number }>();
  private readonly pendingLogins = new Set<string>();

  constructor(private readonly pool: Pool, private readonly config: AppConfig) {}

  private async identity(raw: string | undefined, kind: Identity["kind"], db: Queryable = this.pool): Promise<Identity | null> {
    if (!raw) return null;
    const table = kind === "registered" ? "account_session" : "organizer_credential";
    const result = await db.query<Identity>(`
      SELECT o.id AS organizer_id, o.kind, o.email, o.created_at
      FROM organizer o JOIN ${table} c ON c.organizer_id = o.id
      WHERE c.token_hash = $1 AND c.revoked_at IS NULL AND c.expires_at > now()
        AND o.kind = $2 AND o.status = 'active'
    `, [hashValue(raw), kind]);
    return result.rows[0] ?? null;
  }

  async requireOrganizer(cookies: Cookies): Promise<OrganizerAccess> {
    const account = await this.identity(cookies[ACCOUNT_COOKIE], "registered");
    if (account) return { organizerId: account.organizer_id, kind: "registered", credentialHash: hashValue(cookies[ACCOUNT_COOKIE]!) };
    const guest = await this.identity(cookies[GUEST_COOKIE], "guest");
    if (!guest) throw authRequired();
    return { organizerId: guest.organizer_id, kind: "guest", credentialHash: hashValue(cookies[GUEST_COOKIE]!) };
  }

  async session(cookies: Cookies): Promise<OrganizerSession> {
    const [account, guest] = await Promise.all([
      this.identity(cookies[ACCOUNT_COOKIE], "registered"),
      this.identity(cookies[GUEST_COOKIE], "guest"),
    ]);
    const count = guest ? await this.pool.query<{ count: string }>("SELECT count(*) FROM survey WHERE organizer_id = $1", [guest.organizer_id]) : null;
    return {
      workspace: account ? { kind: "registered", email: account.email!, createdAt: account.created_at.toISOString() }
        : guest ? { kind: "guest", createdAt: guest.created_at.toISOString() } : null,
      guestSurveyCount: Number(count?.rows[0].count ?? 0),
    };
  }

  private async transaction<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      const result = await work(db);
      await db.query("COMMIT");
      return result;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally { db.release(); }
  }

  private async issue(db: Queryable, organizerId: string, oldToken?: string) {
    const rawToken = createBearerToken();
    const expiresAt = addDays(new Date(), this.config.accountSessionDays);
    if (oldToken) await db.query("UPDATE account_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [hashValue(oldToken)]);
    await db.query("INSERT INTO account_session (id, organizer_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [randomUUID(), organizerId, hashValue(rawToken), expiresAt]);
    return { rawToken, expiresAt };
  }

  async register(cookies: Cookies, email: string, password: string) {
    if (await this.identity(cookies[ACCOUNT_COOKIE], "registered")) throw new AppError(409, "ALREADY_SIGNED_IN", "You are already signed in.");
    const guest = await this.identity(cookies[GUEST_COOKIE], "guest");
    if (!guest) throw authRequired();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      return await this.transaction(async (db) => {
        await db.query("SELECT id FROM organizer WHERE id = $1 FOR UPDATE", [guest.organizer_id]);
        if (!await this.identity(cookies[GUEST_COOKIE], "guest", db)) throw authRequired();
        await db.query("UPDATE organizer SET kind = 'registered', email = $2, password_hash = $3, updated_at = now() WHERE id = $1", [guest.organizer_id, email, passwordHash]);
        await db.query("UPDATE organizer_credential SET revoked_at = now() WHERE organizer_id = $1 AND revoked_at IS NULL", [guest.organizer_id]);
        return this.issue(db, guest.organizer_id, cookies[ACCOUNT_COOKIE]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new AppError(409, "REGISTRATION_REQUIRES_SIGN_IN", "We couldn't create this account. Try signing in; your guest surveys are still here.");
      }
      throw error;
    }
  }

  async login(cookies: Cookies, email: string, password: string) {
    const key = hashValue(email).toString("hex");
    const now = Date.now();
    for (const [entryKey, entry] of this.failedLogins) if (entry.until <= now) this.failedLogins.delete(entryKey);
    if (this.pendingLogins.has(key) || (this.failedLogins.get(key)?.count ?? 0) >= 10 || this.pendingLogins.size >= 4 || this.failedLogins.size >= 10_000) {
      throw new AppError(429, "AUTH_RATE_LIMITED", "Too many sign-in attempts. Please try again later.");
    }
    this.pendingLogins.add(key);
    try {
      const result = await this.pool.query<{ id: string; password_hash: string }>(
        "SELECT id, password_hash FROM organizer WHERE lower(email) = $1 AND kind = 'registered' AND status = 'active'", [email]);
      const account = result.rows[0];
      this.dummyHash ??= argon2.hash(createBearerToken(), { type: argon2.argon2id });
      const matches = await argon2.verify(account?.password_hash ?? await this.dummyHash, password);
      if (!account || !matches) {
        const previous = this.failedLogins.get(key);
        this.failedLogins.set(key, { count: (previous?.count ?? 0) + 1, until: previous?.until ?? now + 15 * 60_000 });
        throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
      }
      this.failedLogins.delete(key);
      const issued = await this.transaction((db) => this.issue(db, account.id, cookies[ACCOUNT_COOKIE]));
      const session = await this.session({ ...cookies, [ACCOUNT_COOKIE]: issued.rawToken });
      return { ...issued, guestWorkspacePending: session.guestSurveyCount > 0 };
    } finally { this.pendingLogins.delete(key); }
  }

  async claim(cookies: Cookies, confirm: boolean): Promise<{ transferredSurveyCount: number }> {
    if (!confirm) throw new AppError(422, "CONFIRMATION_REQUIRED", "Please confirm moving your guest surveys.");
    const [account, guest] = await Promise.all([this.identity(cookies[ACCOUNT_COOKIE], "registered"), this.identity(cookies[GUEST_COOKIE], "guest")]);
    if (!account) throw authRequired();
    if (!guest) throw new AppError(409, "CLAIM_NOT_AVAILABLE", "There are no guest surveys to move.");
    return this.transaction(async (db) => {
      await db.query("SELECT id FROM organizer WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [[account.organizer_id, guest.organizer_id]]);
      if (!await this.identity(cookies[ACCOUNT_COOKIE], "registered", db) || !await this.identity(cookies[GUEST_COOKIE], "guest", db)) throw authRequired();
      const moved = await db.query("UPDATE survey SET organizer_id = $2, updated_at = now() WHERE organizer_id = $1", [guest.organizer_id, account.organizer_id]);
      await db.query("UPDATE organizer SET status = 'merged', merged_into_organizer_id = $2, updated_at = now() WHERE id = $1", [guest.organizer_id, account.organizer_id]);
      await db.query("UPDATE organizer_credential SET revoked_at = now() WHERE organizer_id = $1 AND revoked_at IS NULL", [guest.organizer_id]);
      return { transferredSurveyCount: moved.rowCount ?? 0 };
    });
  }

  async logout(cookies: Cookies): Promise<void> {
    if (cookies[ACCOUNT_COOKIE]) await this.pool.query("UPDATE account_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [hashValue(cookies[ACCOUNT_COOKIE]!)]);
  }
}
