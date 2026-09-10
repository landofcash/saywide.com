import { randomUUID } from "node:crypto";

import type {
  PublicSurvey,
  SurveyDetail,
  SurveyDraftInput,
  SurveyStatus,
  SurveySummary,
  SurveySummaryResponse,
} from "@saywide/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

interface GuestRow extends QueryResultRow {
  organizer_id: string;
  credential_id: string;
  created_at: Date;
}

interface SurveyRow extends QueryResultRow {
  id: string;
  organizer_id: string;
  public_token: string;
  title: string;
  intro: string;
  status: SurveyStatus;
  access_code_hash: string | null;
  min_report_responses: number;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  question_count: string;
  started_response_count: string;
  submitted_response_count: string;
  last_submitted_at: Date | null;
  report_state: string;
}

interface QuestionRow extends QueryResultRow {
  id: string;
  position: number;
  prompt: string;
  required: boolean;
}

interface ResponseSessionRow extends QueryResultRow {
  id: string;
  client_session_id: string;
  survey_id: string;
  public_label: string;
  status: string;
  consent_version: string;
  expires_at: Date;
  submitted_at: Date | null;
}

interface IdempotencyRow extends QueryResultRow {
  id: string;
  request_hash: Buffer;
  resource_id: string;
}

const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const nullableIso = (value: Date | string | null): string | null => value ? iso(value) : null;

function toSummary(row: SurveyRow): SurveySummary {
  return {
    surveyId: row.id,
    title: row.title,
    status: row.status,
    questionCount: Number(row.question_count),
    submittedResponseCount: Number(row.submitted_response_count),
    reportState: row.report_state,
    expiresAt: nullableIso(row.expires_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class SaywideRepository {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async checkHealth(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async findGuestByTokenHash(tokenHash: Buffer): Promise<GuestRow | null> {
    const result = await this.pool.query<GuestRow>(`
      SELECT o.id AS organizer_id, oc.id AS credential_id, o.created_at
      FROM organizer_credential oc
      JOIN organizer o ON o.id = oc.organizer_id
      WHERE oc.token_hash = $1
        AND oc.revoked_at IS NULL
        AND oc.expires_at > now()
        AND o.kind = 'guest'
        AND o.status = 'active'
      LIMIT 1
    `, [tokenHash]);
    return result.rows[0] ?? null;
  }

  async refreshGuestCredential(credentialId: string, expiresAt: Date): Promise<void> {
    await this.pool.query(`
      UPDATE organizer_credential
      SET expires_at = $2, last_used_at = now()
      WHERE id = $1
    `, [credentialId, expiresAt]);
  }

  async createGuest(tokenHash: Buffer, expiresAt: Date): Promise<GuestRow> {
    return this.transaction(async (client) => {
      const organizerId = randomUUID();
      const credentialId = randomUUID();
      const organizer = await client.query<{ created_at: Date }>(`
        INSERT INTO organizer (id) VALUES ($1) RETURNING created_at
      `, [organizerId]);
      await client.query(`
        INSERT INTO organizer_credential (id, organizer_id, token_hash, expires_at, last_used_at)
        VALUES ($1, $2, $3, $4, now())
      `, [credentialId, organizerId, tokenHash, expiresAt]);
      return { organizer_id: organizerId, credential_id: credentialId, created_at: organizer.rows[0].created_at } as GuestRow;
    });
  }

  async listSurveys(organizerId: string, status: SurveyStatus | undefined, limit: number): Promise<SurveySummary[]> {
    const values: unknown[] = [organizerId, limit];
    const statusClause = status ? "AND s.status = $3" : "";
    if (status) values.push(status);
    const result = await this.pool.query<SurveyRow>(`
      SELECT s.*,
        (SELECT count(*) FROM question q WHERE q.survey_id = s.id) AS question_count,
        (SELECT count(*) FROM response_session rs WHERE rs.survey_id = s.id) AS started_response_count,
        (SELECT count(*) FROM response_session rs WHERE rs.survey_id = s.id AND rs.status = 'submitted') AS submitted_response_count,
        (SELECT max(rs.submitted_at) FROM response_session rs WHERE rs.survey_id = s.id AND rs.status = 'submitted') AS last_submitted_at,
        COALESCE((SELECT CASE
          WHEN rr.status = 'completed' THEN 'Complete'
          WHEN rr.status = 'failed' THEN 'Failed'
          ELSE 'In progress'
        END FROM report_request rr WHERE rr.survey_id = s.id ORDER BY rr.created_at DESC LIMIT 1), 'Not started') AS report_state
      FROM survey s
      WHERE s.organizer_id = $1 ${statusClause}
      ORDER BY s.updated_at DESC, s.id DESC
      LIMIT $2
    `, values);
    return result.rows.map(toSummary);
  }

  async getSurveyDetail(organizerId: string, surveyId: string, queryable: Queryable = this.pool): Promise<SurveyDetail | null> {
    const result = await queryable.query<SurveyRow>(`
      SELECT s.*,
        (SELECT count(*) FROM question q WHERE q.survey_id = s.id) AS question_count,
        (SELECT count(*) FROM response_session rs WHERE rs.survey_id = s.id) AS started_response_count,
        (SELECT count(*) FROM response_session rs WHERE rs.survey_id = s.id AND rs.status = 'submitted') AS submitted_response_count,
        (SELECT max(rs.submitted_at) FROM response_session rs WHERE rs.survey_id = s.id AND rs.status = 'submitted') AS last_submitted_at,
        COALESCE((SELECT CASE
          WHEN rr.status = 'completed' THEN 'Complete'
          WHEN rr.status = 'failed' THEN 'Failed'
          ELSE 'In progress'
        END FROM report_request rr WHERE rr.survey_id = s.id ORDER BY rr.created_at DESC LIMIT 1), 'Not started') AS report_state
      FROM survey s
      WHERE s.id = $1 AND s.organizer_id = $2
      LIMIT 1
    `, [surveyId, organizerId]);
    const row = result.rows[0];
    if (!row) return null;
    const questions = await queryable.query<QuestionRow>(`
      SELECT id, position, prompt, required FROM question WHERE survey_id = $1 ORDER BY position
    `, [surveyId]);
    return {
      ...toSummary(row),
      introduction: row.intro,
      questions: questions.rows.map((question) => ({
        questionId: question.id,
        prompt: question.prompt,
        required: question.required,
        position: question.position - 1,
      })),
      settings: {
        expiresAt: nullableIso(row.expires_at),
        hasAccessCode: Boolean(row.access_code_hash),
        minReportResponses: row.min_report_responses,
      },
      publicToken: row.status === "draft" ? null : row.public_token,
      participantUrl: row.status === "draft" ? null : `/s/${row.public_token}`,
      startedResponseCount: Number(row.started_response_count),
      lastSubmittedAt: nullableIso(row.last_submitted_at),
    };
  }

  async createSurvey(
    organizerId: string,
    input: SurveyDraftInput,
    surveyId: string,
    publicToken: string,
    queryable: Queryable,
  ): Promise<void> {
    await queryable.query(`
      INSERT INTO survey (id, organizer_id, public_token, title, intro, min_report_responses, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [surveyId, organizerId, publicToken, input.title, input.introduction, input.settings.minReportResponses, input.settings.expiresAt]);
    for (const [index, question] of input.questions.entries()) {
      await queryable.query(`
        INSERT INTO question (id, survey_id, position, prompt, required)
        VALUES ($1, $2, $3, $4, $5)
      `, [randomUUID(), surveyId, index + 1, question.prompt, question.required]);
    }
  }

  async updateSurvey(
    organizerId: string,
    surveyId: string,
    input: SurveyDraftInput,
  ): Promise<{ kind: "updated"; survey: SurveyDetail } | { kind: "not_found" } | { kind: "not_editable" }> {
    return this.transaction(async (client) => {
      const locked = await client.query<{ status: SurveyStatus; response_count: string }>(`
        SELECT s.status, (SELECT count(*) FROM response_session rs WHERE rs.survey_id = s.id) AS response_count
        FROM survey s WHERE s.id = $1 AND s.organizer_id = $2 FOR UPDATE
      `, [surveyId, organizerId]);
      if (!locked.rows[0]) return { kind: "not_found" } as const;
      if (locked.rows[0].status !== "draft" && Number(locked.rows[0].response_count) > 0) return { kind: "not_editable" } as const;
      await client.query(`
        UPDATE survey SET title = $3, intro = $4, min_report_responses = $5, expires_at = $6, updated_at = now()
        WHERE id = $1 AND organizer_id = $2
      `, [surveyId, organizerId, input.title, input.introduction, input.settings.minReportResponses, input.settings.expiresAt]);
      await client.query("DELETE FROM question WHERE survey_id = $1", [surveyId]);
      for (const [index, question] of input.questions.entries()) {
        await client.query(`
          INSERT INTO question (id, survey_id, position, prompt, required)
          VALUES ($1, $2, $3, $4, $5)
        `, [randomUUID(), surveyId, index + 1, question.prompt, question.required]);
      }
      const survey = await this.getSurveyDetail(organizerId, surveyId, client);
      if (!survey) return { kind: "not_found" } as const;
      return { kind: "updated", survey } as const;
    });
  }

  async setSurveyStatus(organizerId: string, surveyId: string, status: "open" | "closed"): Promise<SurveyDetail | null> {
    const result = await this.pool.query(`
      UPDATE survey SET status = $3, updated_at = now()
      WHERE id = $1 AND organizer_id = $2
      RETURNING id
    `, [surveyId, organizerId, status]);
    if (result.rowCount === 0) return null;
    return this.getSurveyDetail(organizerId, surveyId);
  }

  async getSurveySummary(organizerId: string, surveyId: string): Promise<SurveySummaryResponse | null> {
    const detail = await this.getSurveyDetail(organizerId, surveyId);
    if (!detail) return null;
    return {
      surveyId: detail.surveyId,
      status: detail.status,
      startedResponseCount: detail.startedResponseCount,
      submittedResponseCount: detail.submittedResponseCount,
      reportEligible: detail.submittedResponseCount >= detail.settings.minReportResponses,
      minReportResponses: detail.settings.minReportResponses,
      expiresAt: detail.expiresAt,
      lastSubmittedAt: detail.lastSubmittedAt,
    };
  }

  async getPublicSurvey(publicToken: string, queryable: Queryable = this.pool): Promise<{ survey: PublicSurvey; id: string; accessCodeHash: string | null; expiresAt: Date | null } | null> {
    const result = await queryable.query<SurveyRow>(`
      SELECT s.*, '0' AS question_count, '0' AS started_response_count, '0' AS submitted_response_count,
        NULL::timestamptz AS last_submitted_at, 'Not started' AS report_state
      FROM survey s WHERE s.public_token = $1 AND s.status <> 'archived' LIMIT 1
    `, [publicToken]);
    const row = result.rows[0];
    if (!row) return null;
    const questions = await queryable.query<QuestionRow>(`
      SELECT id, position, prompt, required FROM question WHERE survey_id = $1 ORDER BY position
    `, [row.id]);
    return {
      id: row.id,
      accessCodeHash: row.access_code_hash,
      expiresAt: row.expires_at,
      survey: {
        publicToken,
        title: row.title,
        introduction: row.intro,
        status: row.status,
        questions: questions.rows.map((question) => ({
          questionId: question.id,
          prompt: question.prompt,
          required: question.required,
          position: question.position - 1,
        })),
        estimatedMinutes: Math.max(2, questions.rows.length * 2),
        requiresAccessCode: Boolean(row.access_code_hash),
        consentVersion: "2026-09-01",
      },
    };
  }

  async lockIdempotencyScope(queryable: Queryable, lockKey: string): Promise<void> {
    await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);
  }

  async findIdempotency(
    queryable: Queryable,
    scopeKind: "organizer" | "public_survey",
    scopeId: string,
    operation: string,
    keyHash: Buffer,
  ): Promise<IdempotencyRow | null> {
    const result = await queryable.query<IdempotencyRow>(`
      SELECT id, request_hash, resource_id FROM idempotency_operation
      WHERE scope_kind = $1 AND scope_id = $2 AND operation = $3 AND key_hash = $4 AND expires_at > now()
      LIMIT 1
    `, [scopeKind, scopeId, operation, keyHash]);
    return result.rows[0] ?? null;
  }

  async createIdempotency(
    queryable: Queryable,
    values: { id: string; scopeKind: "organizer" | "public_survey"; scopeId: string; operation: string; keyHash: Buffer; requestHash: Buffer; resourceId: string; expiresAt: Date },
  ): Promise<void> {
    await queryable.query(`
      INSERT INTO idempotency_operation (id, scope_kind, scope_id, operation, key_hash, request_hash, resource_id, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [values.id, values.scopeKind, values.scopeId, values.operation, values.keyHash, values.requestHash, values.resourceId, values.expiresAt]);
  }

  async createResponseSession(queryable: Queryable, values: {
    id: string;
    clientSessionId: string;
    surveyId: string;
    tokenHash: Buffer;
    publicLabel: string;
    consentVersion: string;
    expiresAt: Date;
  }): Promise<void> {
    await queryable.query(`
      INSERT INTO response_session (id, client_session_id, survey_id, session_token_hash, public_label, consent_version, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [values.id, values.clientSessionId, values.surveyId, values.tokenHash, values.publicLabel, values.consentVersion, values.expiresAt]);
  }

  async nextPublicLabel(queryable: Queryable, surveyId: string): Promise<string> {
    await this.lockIdempotencyScope(queryable, `response-label:${surveyId}`);
    const result = await queryable.query<{ count: string }>("SELECT count(*) AS count FROM response_session WHERE survey_id = $1", [surveyId]);
    return `Response A${String(Number(result.rows[0].count) + 1).padStart(2, "0")}`;
  }

  async getResponseSession(queryable: Queryable, clientSessionId: string, tokenHash: Buffer, lock = false): Promise<ResponseSessionRow | null> {
    const result = await queryable.query<ResponseSessionRow>(`
      SELECT id, client_session_id, survey_id, public_label, status, consent_version, expires_at, submitted_at
      FROM response_session
      WHERE client_session_id = $1 AND session_token_hash = $2
      ${lock ? "FOR UPDATE" : ""}
    `, [clientSessionId, tokenHash]);
    return result.rows[0] ?? null;
  }

  async getResponseSessionById(queryable: Queryable, id: string): Promise<ResponseSessionRow | null> {
    const result = await queryable.query<ResponseSessionRow>(`
      SELECT id, client_session_id, survey_id, public_label, status, consent_version, expires_at, submitted_at
      FROM response_session WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async questionBelongsToSurvey(queryable: Queryable, questionId: string, surveyId: string): Promise<boolean> {
    const result = await queryable.query("SELECT 1 FROM question WHERE id = $1 AND survey_id = $2", [questionId, surveyId]);
    return Boolean(result.rowCount);
  }

  async saveAnswer(queryable: Queryable, responseSessionId: string, questionId: string, finalText: string): Promise<Date> {
    const result = await queryable.query<{ updated_at: Date }>(`
      INSERT INTO answer (id, response_session_id, question_id, final_text, input_mode, audio_status)
      VALUES ($1, $2, $3, $4, 'text', 'not_used')
      ON CONFLICT (response_session_id, question_id)
      DO UPDATE SET final_text = EXCLUDED.final_text, input_mode = 'text', audio_status = 'not_used', updated_at = now()
      RETURNING updated_at
    `, [randomUUID(), responseSessionId, questionId, finalText]);
    return result.rows[0].updated_at;
  }

  async missingRequiredQuestionIds(queryable: Queryable, responseSessionId: string, surveyId: string): Promise<string[]> {
    const result = await queryable.query<{ id: string }>(`
      SELECT q.id FROM question q
      LEFT JOIN answer a ON a.question_id = q.id AND a.response_session_id = $1
      WHERE q.survey_id = $2 AND q.required = true AND (a.id IS NULL OR length(btrim(a.final_text)) = 0)
      ORDER BY q.position
    `, [responseSessionId, surveyId]);
    return result.rows.map((row) => row.id);
  }

  async submitResponse(queryable: Queryable, responseSessionId: string): Promise<{ submittedAt: Date; publicLabel: string }> {
    const result = await queryable.query<{ submitted_at: Date; public_label: string }>(`
      UPDATE response_session
      SET status = 'submitted', submitted_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING submitted_at, public_label
    `, [responseSessionId]);
    return { submittedAt: result.rows[0].submitted_at, publicLabel: result.rows[0].public_label };
  }
}
