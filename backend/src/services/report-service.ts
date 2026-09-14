import { randomUUID } from "node:crypto";
import type { OrganizerAccess } from "./auth-service.js";

import type { CreateReportResponse, ReportResult, ReportSummary } from "@saywide/contracts";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import { AppError, notFound } from "../errors.js";
import { ReportRepository, type ValidatedFindingRecord, type ValidatedReportRecord } from "../repositories/report-repository.js";
import { hashJson, hashValue } from "../security.js";
import type { CandidateReport, FrozenReportSnapshot, ReportAnalyzer } from "./report-analyzer.js";

const MODEL_OUTPUT_ERROR = "REPORT_MODEL_OUTPUT_INVALID";
const identifyingExcerpt = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|https?:\/\/|\b(?:\+?\d[\d\s().-]{7,}\d)\b/i;

function normalized(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function confidence(supportCount: number, eligibleResponseCount: number): "low" | "medium" | "high" {
  const proportion = eligibleResponseCount === 0 ? 0 : supportCount / eligibleResponseCount;
  if (supportCount >= 3 && proportion >= 0.5) return "high";
  if (supportCount >= 2) return "medium";
  return "low";
}

function markdownFor(report: Omit<ValidatedReportRecord, "markdown">, title: string, instruction: string): string {
  const findings = report.findings.map((finding) => [
    `## ${finding.title}`,
    finding.summary,
    `- Support: ${finding.supportCount}/${report.eligibleResponseCount} (${finding.supportPercentage}%)`,
    `- Confidence: ${finding.confidence}`,
    `- Suggested action: ${finding.suggestedAction}`,
    "### Evidence",
    finding.evidence.map((item) => `> “${item.excerpt}” — ${item.publicLabel}`).join("\n\n"),
  ].join("\n\n")).join("\n\n");
  const sections = [
    `# ${title}`,
    instruction,
    findings,
    "## Limitations",
    report.limitations.map((item) => `- ${item}`).join("\n"),
  ];
  if (report.minorityViews.length > 0) {
    sections.push("## Minority views", report.minorityViews.map((item) => `- ${item}`).join("\n"));
  }
  if (report.followUpQuestions.length > 0) {
    sections.push("## Follow-up questions", report.followUpQuestions.map((item) => `- ${item}`).join("\n"));
  }
  return sections.join("\n\n");
}

export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly analyzer: ReportAnalyzer,
    private readonly config: AppConfig,
  ) {}

  async create(organizerId: string, surveyId: string, instruction: string, idempotencyKey: string | undefined, access: OrganizerAccess): Promise<CreateReportResponse> {
    const result = await this.repository.createRequest({
      access,
      organizerId,
      surveyId,
      instruction,
      modelProvider: this.config.modelProvider,
      modelId: this.config.modelProvider === "openai" ? this.config.openAiModelId : this.config.bedrockModelId,
      maxResponses: this.config.reportMaxResponses,
      idempotency: idempotencyKey ? {
        keyHash: hashValue(idempotencyKey),
        requestHash: hashJson({ surveyId, instruction }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } : undefined,
    });
    if ("kind" in result) {
      if (result.kind === "not_found") throw notFound("SURVEY_NOT_FOUND");
      if (result.kind === "already_running") throw new AppError(409, "REPORT_ALREADY_RUNNING", "A report is already running for this survey.");
      if (result.kind === "too_few") {
        throw new AppError(422, "TOO_FEW_RESPONSES", "There are not enough submitted responses to create a report.", {
          submittedResponseCount: String(result.count),
          minReportResponses: String(result.minimum),
        });
      }
      if (result.kind === "idempotency_reused") {
        throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for a different request.");
      }
      if (result.kind === "idempotency_unavailable") {
        throw new AppError(409, "IDEMPOTENCY_RESULT_UNAVAILABLE", "The previous operation result is no longer available.");
      }
      throw new AppError(422, "REPORT_RESPONSE_LIMIT_EXCEEDED", `This first report workflow supports at most ${this.config.reportMaxResponses} responses.`, {
        submittedResponseCount: String(result.count),
        maxReportResponses: String(this.config.reportMaxResponses),
      });
    }
    return {
      reportId: result.requestId,
      reportRequestId: result.requestId,
      status: "queued",
      snapshotAt: result.snapshotAt.toISOString(),
    };
  }

  async process(requestId: string): Promise<void> {
    if (!await this.repository.startProcessing(requestId)) return;
    try {
      const snapshotStarted = performance.now();
      const snapshot = await this.repository.loadSnapshot(requestId);
      if (!snapshot) throw new Error("Report snapshot was not found");
      const instruction = await this.repository.getInstruction(requestId);
      if (!instruction) throw new Error("Report instruction was not found");
      await this.repository.setStage(requestId, "analyzing", "snapshot_loaded", "load_response_snapshot", Math.round(performance.now() - snapshotStarted));

      const analysisStarted = performance.now();
      const analysis = await this.analyzer.analyze(snapshot, instruction, (event) => this.repository.recordActivity(requestId, event));
      await this.repository.setStage(requestId, "validating", "themes_extracted", "extract_themes", Math.round(performance.now() - analysisStarted));

      const validationStarted = performance.now();
      const validated = this.validate(snapshot, analysis.candidate, instruction);
      await this.repository.setStage(requestId, "validating", "evidence_validated", "validate_assignments_and_evidence", Math.round(performance.now() - validationStarted));
      await this.repository.complete(requestId, validated, analysis.usage);
    } catch (error) {
      const errorCode = error instanceof z.ZodError || (error instanceof Error && error.message === MODEL_OUTPUT_ERROR)
        ? MODEL_OUTPUT_ERROR
        : "REPORT_PROVIDER_UNAVAILABLE";
      await this.repository.fail(requestId, errorCode);
      throw error;
    }
  }

  async queuedRequestIds(): Promise<string[]> {
    return this.repository.listQueuedRequestIds();
  }

  async list(organizerId: string, surveyId: string, limit: number): Promise<ReportSummary[]> {
    const reports = await this.repository.list(organizerId, surveyId, limit);
    if (!reports) throw notFound("SURVEY_NOT_FOUND");
    return reports;
  }

  async get(organizerId: string, reportId: string): Promise<ReportResult> {
    const result = await this.repository.get(organizerId, reportId);
    if (!result) throw notFound("REPORT_NOT_FOUND");
    const activity = await this.repository.activity(organizerId, reportId);
    if (result.kind === "progress") {
      return { reportId, status: result.status, snapshotAt: result.snapshotAt, progress: result.progress, ...activity };
    }
    if (result.kind === "failed") {
      return { reportId, status: "failed", snapshotAt: result.snapshotAt, retryable: true, errorCode: result.errorCode, ...activity };
    }
    return { reportId, status: "completed", snapshotAt: result.snapshotAt, report: result.report, ...activity };
  }

  private validate(snapshot: FrozenReportSnapshot, candidate: CandidateReport, instruction: string): ValidatedReportRecord {
    const questionIds = new Set(snapshot.questions.map((question) => question.questionId));
    const responseMap = new Map(snapshot.responses.map((response) => [response.responseSessionId, response]));
    const answerMap = new Map(snapshot.responses.flatMap((response) => response.answers.map((answer) => [answer.answerId, {
      ...answer,
      responseSessionId: response.responseSessionId,
      publicLabel: response.publicLabel,
    }] as const)));
    const findings: ValidatedFindingRecord[] = [];

    for (const candidateFinding of candidate.findings) {
      if (identifyingExcerpt.test([
        candidateFinding.title,
        candidateFinding.summary,
        candidateFinding.suggestedAction,
      ].join(" "))) continue;
      const validAssignments: Array<{ responseSessionId: string; questionId: string; reason: string }> = [];
      for (const assignment of candidateFinding.assignments) {
        const response = responseMap.get(assignment.responseSessionId);
        if (!response || !questionIds.has(assignment.questionId)) continue;
        if (!response.answers.some((answer) => answer.questionId === assignment.questionId)) continue;
        validAssignments.push({
          responseSessionId: assignment.responseSessionId,
          questionId: assignment.questionId,
          reason: "Model-proposed assignment validated against a submitted answer.",
        });
      }
      const assignments = new Map<string, { responseSessionId: string; questionId: string; reason: string }>();
      for (const assignment of validAssignments) {
        if (!assignments.has(assignment.responseSessionId)) assignments.set(assignment.responseSessionId, assignment);
      }
      const evidence: ValidatedFindingRecord["evidence"] = [];
      for (const candidateEvidence of candidateFinding.evidence) {
        const answer = answerMap.get(candidateEvidence.answerId);
        if (!answer) continue;
        const matchingAssignment = validAssignments.find((assignment) =>
          assignment.responseSessionId === answer.responseSessionId && assignment.questionId === answer.questionId,
        );
        if (!matchingAssignment) continue;
        assignments.set(answer.responseSessionId, matchingAssignment);
        const excerpt = normalized(candidateEvidence.excerpt);
        if (!normalized(answer.text).toLocaleLowerCase().includes(excerpt.toLocaleLowerCase())) continue;
        if (identifyingExcerpt.test(excerpt)) continue;
        if (!evidence.some((item) => item.answerId === answer.answerId)) {
          evidence.push({ answerId: answer.answerId, excerpt, publicLabel: answer.publicLabel });
        }
      }
      if (assignments.size === 0 || evidence.length === 0) continue;
      const supportCount = assignments.size;
      findings.push({
        id: randomUUID(),
        title: candidateFinding.title,
        category: candidateFinding.category,
        summary: candidateFinding.summary,
        supportCount,
        supportPercentage: Math.round((supportCount / snapshot.responses.length) * 10000) / 100,
        confidence: confidence(supportCount, snapshot.responses.length),
        suggestedAction: candidateFinding.suggestedAction,
        assignments: [...assignments.values()],
        evidence,
      });
    }

    if (findings.length === 0) throw new Error(MODEL_OUTPUT_ERROR);
    const limitations = [
      `The report describes ${snapshot.responses.length} submitted response sessions, not verified unique people.`,
      "Open-ended responses may overrepresent experiences participants felt strongly about.",
      ...candidate.limitations.filter((item) => !identifyingExcerpt.test(item)),
    ].filter((item, index, values) => values.indexOf(item) === index).slice(0, 5);
    const reportWithoutMarkdown = {
      eligibleResponseCount: snapshot.responses.length,
      limitations,
      minorityViews: findings.filter((finding) => finding.category === "minority-view").map((finding) => finding.summary),
      followUpQuestions: candidate.followUpQuestions.filter((item) => !identifyingExcerpt.test(item)),
      findings,
    };
    return {
      ...reportWithoutMarkdown,
      markdown: markdownFor(reportWithoutMarkdown, snapshot.surveyTitle, instruction),
    };
  }
}
