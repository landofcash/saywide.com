import { randomUUID } from "node:crypto";

import type { Report, ReportSummary } from "@saywide/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import type { FrozenReportSnapshot } from "../services/report-analyzer.js";

type InternalReportStatus = "queued" | "preparing" | "analyzing" | "validating" | "completed" | "failed";

interface ReportRequestRow extends QueryResultRow {
  id: string;
  survey_id: string;
  survey_title: string;
  instruction: string;
  snapshot_at: Date;
  status: InternalReportStatus;
  created_at: Date;
  completed_at: Date | null;
  eligible_response_count: string;
  error_code: string | null;
  latest_event_type: string | null;
}

interface SnapshotRow extends QueryResultRow {
  survey_id: string;
  survey_title: string;
  question_id: string;
  question_prompt: string;
  question_position: number;
  response_session_id: string | null;
  public_label: string | null;
  answer_id: string | null;
  answer_text: string | null;
}

export interface ValidatedFindingRecord {
  id: string;
  title: string;
  category: "strength" | "friction" | "minority-view" | "opportunity";
  summary: string;
  supportCount: number;
  supportPercentage: number;
  confidence: "low" | "medium" | "high";
  suggestedAction: string;
  assignments: Array<{ responseSessionId: string; questionId: string; reason: string }>;
  evidence: Array<{ answerId: string; excerpt: string; publicLabel: string }>;
}

export interface ValidatedReportRecord {
  markdown: string;
  eligibleResponseCount: number;
  limitations: string[];
  minorityViews: string[];
  followUpQuestions: string[];
  findings: ValidatedFindingRecord[];
}

const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

function publicStatus(status: InternalReportStatus): "queued" | "running" | "completed" | "failed" {
  if (status === "preparing" || status === "analyzing" || status === "validating") return "running";
  return status;
}

function progressLabel(status: InternalReportStatus, latestEventType: string | null): string {
  if (latestEventType === "evidence_validated") return "Writing report";
  switch (status) {
    case "queued": return "Queued";
    case "preparing": return "Preparing response snapshot";
    case "analyzing": return "Finding themes";
    case "validating": return "Checking evidence";
    case "completed": return "Completed";
    case "failed": return "Failed";
  }
}

export class ReportRepository {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await callback(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createRequest(values: {
    organizerId: string;
    surveyId: string;
    instruction: string;
    modelProvider: string;
    modelId: string;
    maxResponses: number;
    idempotency?: { keyHash: Buffer; requestHash: Buffer; expiresAt: Date };
  }): Promise<{ requestId: string; snapshotAt: Date; eligibleResponseCount: number } | { kind: "not_found" | "already_running" | "too_few" | "too_many" | "idempotency_reused" | "idempotency_unavailable"; count?: number; minimum?: number }> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`report:${values.surveyId}`]);
      const databaseTime = await client.query<{ snapshot_at: Date }>("SELECT clock_timestamp() AS snapshot_at");
      const snapshotAt = databaseTime.rows[0].snapshot_at;
      const survey = await client.query<{ min_report_responses: number; response_count: string }>(`
        SELECT s.min_report_responses,
          (SELECT count(*) FROM response_session rs
           WHERE rs.survey_id = s.id AND rs.status = 'submitted' AND rs.submitted_at <= $3) AS response_count
        FROM survey s
        WHERE s.id = $1 AND s.organizer_id = $2
      `, [values.surveyId, values.organizerId, snapshotAt]);
      const surveyRow = survey.rows[0];
      if (!surveyRow) return { kind: "not_found" } as const;

      if (values.idempotency) {
        const existing = await client.query<{ request_hash: Buffer; resource_id: string; snapshot_at: Date; response_count: string }>(`
          SELECT io.request_hash, io.resource_id, rr.snapshot_at,
            (SELECT count(*) FROM response_session rs WHERE rs.survey_id = rr.survey_id
             AND rs.status = 'submitted' AND rs.submitted_at <= rr.snapshot_at) AS response_count
          FROM idempotency_operation io
          LEFT JOIN report_request rr ON rr.id = io.resource_id
          WHERE io.scope_kind = 'organizer' AND io.scope_id = $1 AND io.operation = 'create_report'
            AND io.key_hash = $2 AND io.expires_at > now()
        `, [values.organizerId, values.idempotency.keyHash]);
        const existingRow = existing.rows[0];
        if (existingRow) {
          if (!existingRow.request_hash.equals(values.idempotency.requestHash)) return { kind: "idempotency_reused" } as const;
          if (!existingRow.snapshot_at) return { kind: "idempotency_unavailable" } as const;
          return {
            requestId: existingRow.resource_id,
            snapshotAt: existingRow.snapshot_at,
            eligibleResponseCount: Number(existingRow.response_count),
          };
        }
      }

      const active = await client.query(`
        SELECT 1 FROM report_request
        WHERE survey_id = $1 AND status IN ('queued', 'preparing', 'analyzing', 'validating')
        LIMIT 1
      `, [values.surveyId]);
      if (active.rowCount) return { kind: "already_running" } as const;

      const count = Number(surveyRow.response_count);
      if (count < surveyRow.min_report_responses) {
        return { kind: "too_few", count, minimum: surveyRow.min_report_responses } as const;
      }
      if (count > values.maxResponses) return { kind: "too_many", count } as const;

      const requestId = randomUUID();
      const runId = randomUUID();
      await client.query(`
        INSERT INTO report_request (id, survey_id, instruction, snapshot_at)
        VALUES ($1, $2, $3, $4)
      `, [requestId, values.surveyId, values.instruction, snapshotAt]);
      await client.query(`
        INSERT INTO agent_run (id, survey_id, report_request_id, run_type, model_provider, model_id)
        VALUES ($1, $2, $3, 'report', $4, $5)
      `, [runId, values.surveyId, requestId, values.modelProvider, values.modelId]);
      await client.query(`
        INSERT INTO agent_event (id, agent_run_id, sequence, event_type, safe_metadata)
        VALUES ($1, $2, 1, 'queued', $3::jsonb)
      `, [randomUUID(), runId, JSON.stringify({ eligibleResponseCount: count })]);
      if (values.idempotency) {
        await client.query(`
          INSERT INTO idempotency_operation (
            id, scope_kind, scope_id, operation, key_hash, request_hash, resource_id, expires_at
          ) VALUES ($1, 'organizer', $2, 'create_report', $3, $4, $5, $6)
        `, [randomUUID(), values.organizerId, values.idempotency.keyHash, values.idempotency.requestHash, requestId, values.idempotency.expiresAt]);
      }
      return { requestId, snapshotAt, eligibleResponseCount: count };
    });
  }

  async startProcessing(requestId: string): Promise<boolean> {
    return this.transaction(async (client) => {
      const updated = await client.query(`
        UPDATE report_request SET status = 'preparing', updated_at = now()
        WHERE id = $1 AND status = 'queued'
        RETURNING id
      `, [requestId]);
      if (!updated.rowCount) return false;
      await client.query(`
        UPDATE agent_run SET status = 'running', started_at = now(), updated_at = now()
        WHERE report_request_id = $1
      `, [requestId]);
      await this.addEvent(client, requestId, "snapshot_started", "load_response_snapshot");
      return true;
    });
  }

  async loadSnapshot(requestId: string): Promise<FrozenReportSnapshot | null> {
    const request = await this.pool.query<{ survey_id: string; survey_title: string; snapshot_at: Date }>(`
      SELECT rr.survey_id, s.title AS survey_title, rr.snapshot_at
      FROM report_request rr JOIN survey s ON s.id = rr.survey_id
      WHERE rr.id = $1
    `, [requestId]);
    const requestRow = request.rows[0];
    if (!requestRow) return null;

    const rows = await this.pool.query<SnapshotRow>(`
      SELECT s.id AS survey_id, s.title AS survey_title,
        q.id AS question_id, q.prompt AS question_prompt, q.position AS question_position,
        rs.id AS response_session_id, rs.public_label,
        a.id AS answer_id, a.final_text AS answer_text
      FROM survey s
      JOIN question q ON q.survey_id = s.id
      LEFT JOIN response_session rs ON rs.survey_id = s.id
        AND rs.status = 'submitted' AND rs.submitted_at <= $2
      LEFT JOIN answer a ON a.response_session_id = rs.id AND a.question_id = q.id
        AND length(btrim(a.final_text)) > 0
      WHERE s.id = $1
      ORDER BY q.position, rs.public_label
    `, [requestRow.survey_id, requestRow.snapshot_at]);

    const questionMap = new Map<string, { questionId: string; prompt: string; position: number }>();
    const responseMap = new Map<string, { responseSessionId: string; publicLabel: string; answers: Array<{ answerId: string; questionId: string; text: string }> }>();
    for (const row of rows.rows) {
      questionMap.set(row.question_id, { questionId: row.question_id, prompt: row.question_prompt, position: row.question_position });
      if (!row.response_session_id || !row.public_label) continue;
      const response = responseMap.get(row.response_session_id) ?? {
        responseSessionId: row.response_session_id,
        publicLabel: row.public_label,
        answers: [],
      };
      if (row.answer_id && row.answer_text) {
        response.answers.push({ answerId: row.answer_id, questionId: row.question_id, text: row.answer_text });
      }
      responseMap.set(row.response_session_id, response);
    }

    return {
      surveyId: requestRow.survey_id,
      surveyTitle: requestRow.survey_title,
      snapshotAt: iso(requestRow.snapshot_at),
      questions: [...questionMap.values()].sort((a, b) => a.position - b.position).map(({ questionId, prompt }) => ({ questionId, prompt })),
      responses: [...responseMap.values()],
    };
  }

  async getInstruction(requestId: string): Promise<string | null> {
    const result = await this.pool.query<{ instruction: string }>("SELECT instruction FROM report_request WHERE id = $1", [requestId]);
    return result.rows[0]?.instruction ?? null;
  }

  async listQueuedRequestIds(limit = 10): Promise<string[]> {
    const result = await this.pool.query<{ id: string }>(`
      SELECT id FROM report_request WHERE status = 'queued' ORDER BY created_at LIMIT $1
    `, [limit]);
    return result.rows.map((row) => row.id);
  }

  async setStage(requestId: string, status: "analyzing" | "validating", eventType: string, toolName: string, durationMs?: number): Promise<void> {
    await this.transaction(async (client) => {
      await client.query("UPDATE report_request SET status = $2, updated_at = now() WHERE id = $1", [requestId, status]);
      await this.addEvent(client, requestId, eventType, toolName, durationMs);
    });
  }

  async complete(requestId: string, report: ValidatedReportRecord, usage: Record<string, number>): Promise<void> {
    await this.transaction(async (client) => {
      const reportId = randomUUID();
      await client.query(`
        INSERT INTO report (
          id, report_request_id, schema_version, markdown, eligible_response_count,
          limitations, minority_views, follow_up_questions
        )
        VALUES ($1, $2, '1.0', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
      `, [
        reportId,
        requestId,
        report.markdown,
        report.eligibleResponseCount,
        JSON.stringify(report.limitations),
        JSON.stringify(report.minorityViews),
        JSON.stringify(report.followUpQuestions),
      ]);

      for (const [index, finding] of report.findings.entries()) {
        await client.query(`
          INSERT INTO finding (id, report_id, position, title, category, summary, support_count, support_percent, confidence, suggested_action)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [finding.id, reportId, index + 1, finding.title, finding.category, finding.summary, finding.supportCount, finding.supportPercentage, finding.confidence, finding.suggestedAction]);
        for (const assignment of finding.assignments) {
          await client.query(`
            INSERT INTO theme_assignment (finding_id, response_session_id, question_id, reason, validated)
            VALUES ($1, $2, $3, $4, true)
          `, [finding.id, assignment.responseSessionId, assignment.questionId, assignment.reason]);
        }
        for (const evidence of finding.evidence) {
          await client.query(`
            INSERT INTO evidence (id, finding_id, answer_id, safe_excerpt, public_response_label)
            VALUES ($1, $2, $3, $4, $5)
          `, [randomUUID(), finding.id, evidence.answerId, evidence.excerpt, evidence.publicLabel]);
        }
      }

      await client.query(`
        UPDATE report_request SET status = 'completed', completed_at = now(), updated_at = now()
        WHERE id = $1
      `, [requestId]);
      await client.query(`
        UPDATE agent_run SET status = 'completed', completed_at = now(), usage = $2::jsonb, updated_at = now()
        WHERE report_request_id = $1
      `, [requestId, JSON.stringify(usage)]);
      await this.addEvent(client, requestId, "completed", "save_report");
    });
  }

  async fail(requestId: string, errorCode: string): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`
        UPDATE report_request SET status = 'failed', updated_at = now(), completed_at = NULL WHERE id = $1
      `, [requestId]);
      await client.query(`
        UPDATE agent_run SET status = 'failed', completed_at = now(), error_code = $2, updated_at = now()
        WHERE report_request_id = $1
      `, [requestId, errorCode]);
      await this.addEvent(client, requestId, "failed", null, undefined, { errorCode, retryable: true });
    });
  }

  async list(organizerId: string, surveyId: string, limit: number): Promise<ReportSummary[] | null> {
    const owner = await this.pool.query("SELECT 1 FROM survey WHERE id = $1 AND organizer_id = $2", [surveyId, organizerId]);
    if (!owner.rowCount) return null;
    const result = await this.pool.query<ReportRequestRow>(`
      SELECT rr.id, rr.survey_id, s.title AS survey_title, rr.instruction, rr.snapshot_at, rr.status,
        rr.created_at, rr.completed_at,
        COALESCE(r.eligible_response_count,
          (SELECT count(*) FROM response_session rs WHERE rs.survey_id = rr.survey_id
           AND rs.status = 'submitted' AND rs.submitted_at <= rr.snapshot_at)) AS eligible_response_count,
        ar.error_code,
        (SELECT ae.event_type FROM agent_event ae WHERE ae.agent_run_id = ar.id ORDER BY ae.sequence DESC LIMIT 1) AS latest_event_type
      FROM report_request rr
      JOIN survey s ON s.id = rr.survey_id
      LEFT JOIN report r ON r.report_request_id = rr.id
      LEFT JOIN agent_run ar ON ar.report_request_id = rr.id
      WHERE rr.survey_id = $1
      ORDER BY rr.created_at DESC
      LIMIT $2
    `, [surveyId, limit]);
    return result.rows.map((row) => ({
      reportId: row.id,
      surveyId: row.survey_id,
      instruction: row.instruction,
      status: publicStatus(row.status),
      snapshotAt: iso(row.snapshot_at),
      eligibleResponseCount: Number(row.eligible_response_count),
      createdAt: iso(row.created_at),
      completedAt: row.completed_at ? iso(row.completed_at) : null,
    }));
  }

  async get(organizerId: string, requestId: string): Promise<
    | { kind: "progress"; status: "queued" | "running"; snapshotAt: string; progress: string }
    | { kind: "failed"; snapshotAt: string; errorCode: string }
    | { kind: "completed"; snapshotAt: string; report: Report }
    | null
  > {
    const request = await this.pool.query<ReportRequestRow>(`
      SELECT rr.id, rr.survey_id, s.title AS survey_title, rr.instruction, rr.snapshot_at, rr.status,
        rr.created_at, rr.completed_at,
        COALESCE(r.eligible_response_count,
          (SELECT count(*) FROM response_session rs WHERE rs.survey_id = rr.survey_id
           AND rs.status = 'submitted' AND rs.submitted_at <= rr.snapshot_at)) AS eligible_response_count,
        ar.error_code,
        (SELECT ae.event_type FROM agent_event ae WHERE ae.agent_run_id = ar.id ORDER BY ae.sequence DESC LIMIT 1) AS latest_event_type
      FROM report_request rr
      JOIN survey s ON s.id = rr.survey_id AND s.organizer_id = $2
      LEFT JOIN report r ON r.report_request_id = rr.id
      LEFT JOIN agent_run ar ON ar.report_request_id = rr.id
      WHERE rr.id = $1
    `, [requestId, organizerId]);
    const row = request.rows[0];
    if (!row) return null;
    if (row.status === "failed") return { kind: "failed", snapshotAt: iso(row.snapshot_at), errorCode: row.error_code ?? "REPORT_FAILED" };
    if (row.status !== "completed") {
      return {
        kind: "progress",
        status: publicStatus(row.status) as "queued" | "running",
        snapshotAt: iso(row.snapshot_at),
        progress: progressLabel(row.status, row.latest_event_type),
      };
    }

    const reportResult = await this.pool.query<{ markdown: string; limitations: unknown; minority_views: unknown; follow_up_questions: unknown }>(`
      SELECT markdown, limitations, minority_views, follow_up_questions FROM report WHERE report_request_id = $1
    `, [requestId]);
    const reportSections = reportResult.rows[0];
    const findings = await this.pool.query<{
      id: string; title: string; category: Report["findings"][number]["category"]; summary: string;
      support_count: number; support_percent: string; confidence: Report["findings"][number]["confidence"]; suggested_action: string;
    }>(`
      SELECT f.id, f.title, f.category, f.summary, f.support_count, f.support_percent, f.confidence, f.suggested_action
      FROM finding f JOIN report r ON r.id = f.report_id
      WHERE r.report_request_id = $1 ORDER BY f.position
    `, [requestId]);
    const reportFindings: Report["findings"] = [];
    for (const finding of findings.rows) {
      const evidence = await this.pool.query<{ public_response_label: string; safe_excerpt: string }>(`
        SELECT public_response_label, safe_excerpt FROM evidence WHERE finding_id = $1 ORDER BY created_at, id
      `, [finding.id]);
      reportFindings.push({
        findingId: finding.id,
        title: finding.title,
        category: finding.category,
        summary: finding.summary,
        supportCount: finding.support_count,
        supportPercentage: Number(finding.support_percent),
        confidence: finding.confidence,
        suggestedAction: finding.suggested_action,
        evidence: evidence.rows.map((item) => ({ label: item.public_response_label, excerpt: item.safe_excerpt })),
      });
    }

    return {
      kind: "completed",
      snapshotAt: iso(row.snapshot_at),
      report: {
        reportId: row.id,
        surveyId: row.survey_id,
        surveyTitle: row.survey_title,
        instruction: row.instruction,
        status: "completed",
        snapshotAt: iso(row.snapshot_at),
        eligibleResponseCount: Number(row.eligible_response_count),
        createdAt: iso(row.created_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
        markdown: reportSections?.markdown ?? "",
        limitations: Array.isArray(reportSections?.limitations) ? reportSections.limitations.filter((item): item is string => typeof item === "string") : [],
        minorityViews: Array.isArray(reportSections?.minority_views) ? reportSections.minority_views.filter((item): item is string => typeof item === "string") : [],
        followUpQuestions: Array.isArray(reportSections?.follow_up_questions) ? reportSections.follow_up_questions.filter((item): item is string => typeof item === "string") : [],
        findings: reportFindings,
      },
    };
  }

  private async addEvent(
    client: PoolClient,
    requestId: string,
    eventType: string,
    toolName: string | null,
    durationMs?: number,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await client.query(`
      INSERT INTO agent_event (id, agent_run_id, sequence, event_type, tool_name, duration_ms, safe_metadata)
      SELECT $2, ar.id, COALESCE(max(ae.sequence), 0) + 1, $3, $4, $5, $6::jsonb
      FROM agent_run ar LEFT JOIN agent_event ae ON ae.agent_run_id = ar.id
      WHERE ar.report_request_id = $1
      GROUP BY ar.id
    `, [requestId, randomUUID(), eventType, toolName, durationMs ?? null, JSON.stringify(metadata)]);
  }
}
