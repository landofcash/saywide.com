import { randomUUID } from "node:crypto";

import type {
  PublicSurvey,
  ResponseSession,
  SaveAnswerResponse,
  SubmitResponseResult,
  SurveyDetail,
  SurveyDraftInput,
  SurveyPatchInput,
  SurveyStatus,
  SurveySummary,
  SurveySummaryResponse,
} from "@saywide/contracts";

import type { AppConfig } from "../config.js";
import { AppError, notFound } from "../errors.js";
import { SaywideRepository } from "../repositories/saywide-repository.js";
import { addDays, addMinutes, createBearerToken, createPublicToken, deriveResponseToken, hashJson, hashValue } from "../security.js";

const IDEMPOTENCY_HOURS = 24;

export interface GuestContext {
  organizerId: string;
  createdAt: string;
  rawToken: string;
  expiresAt: Date;
  created: boolean;
}

export class SaywideService {
  constructor(
    private readonly repository: SaywideRepository,
    private readonly config: AppConfig,
  ) {}

  async health(): Promise<void> {
    await this.repository.checkHealth();
  }

  async restoreOrCreateGuest(rawCookie: string | undefined): Promise<GuestContext> {
    const expiresAt = addDays(new Date(), this.config.guestCredentialDays);
    if (rawCookie) {
      const existing = await this.repository.findGuestByTokenHash(hashValue(rawCookie));
      if (existing) {
        await this.repository.refreshGuestCredential(existing.credential_id, expiresAt);
        return {
          organizerId: existing.organizer_id,
          createdAt: existing.created_at.toISOString(),
          rawToken: rawCookie,
          expiresAt,
          created: false,
        };
      }
    }

    const rawToken = createBearerToken();
    const guest = await this.repository.createGuest(hashValue(rawToken), expiresAt);
    return {
      organizerId: guest.organizer_id,
      createdAt: guest.created_at.toISOString(),
      rawToken,
      expiresAt,
      created: true,
    };
  }

  async requireGuest(rawCookie: string | undefined): Promise<{ organizerId: string }> {
    if (!rawCookie) throw new AppError(401, "ORGANIZER_AUTH_REQUIRED", "Organizer access is required.");
    const guest = await this.repository.findGuestByTokenHash(hashValue(rawCookie));
    if (!guest) throw new AppError(401, "ORGANIZER_AUTH_REQUIRED", "Organizer access is required.");
    return { organizerId: guest.organizer_id };
  }

  async listSurveys(organizerId: string, status: SurveyStatus | undefined, limit: number): Promise<SurveySummary[]> {
    return this.repository.listSurveys(organizerId, status, limit);
  }

  async getSurvey(organizerId: string, surveyId: string): Promise<SurveyDetail> {
    return await this.repository.getSurveyDetail(organizerId, surveyId) ?? (() => { throw notFound("SURVEY_NOT_FOUND"); })();
  }

  async createSurvey(organizerId: string, input: SurveyDraftInput, idempotencyKey?: string): Promise<SurveyDetail> {
    this.assertPhaseOneSettings(input);
    const requestHash = hashJson(input);
    const keyHash = idempotencyKey ? hashValue(idempotencyKey) : null;
    const surveyId = randomUUID();

    return this.repository.transaction(async (client) => {
      if (keyHash) {
        const lockKey = `organizer:${organizerId}:create-survey:${keyHash.toString("hex")}`;
        await this.repository.lockIdempotencyScope(client, lockKey);
        const existing = await this.repository.findIdempotency(client, "organizer", organizerId, "create_survey", keyHash);
        if (existing) {
          if (!existing.request_hash.equals(requestHash)) {
            throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for a different request.");
          }
          const survey = await this.repository.getSurveyDetail(organizerId, existing.resource_id, client);
          if (!survey) throw new AppError(409, "IDEMPOTENCY_RESULT_UNAVAILABLE", "The previous operation result is no longer available.");
          return survey;
        }
      }

      await this.repository.createSurvey(organizerId, input, surveyId, createPublicToken(), client);
      if (keyHash) {
        await this.repository.createIdempotency(client, {
          id: randomUUID(),
          scopeKind: "organizer",
          scopeId: organizerId,
          operation: "create_survey",
          keyHash,
          requestHash,
          resourceId: surveyId,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_HOURS * 60 * 60 * 1000),
        });
      }
      const survey = await this.repository.getSurveyDetail(organizerId, surveyId, client);
      if (!survey) throw new Error("Created survey could not be loaded");
      return survey;
    });
  }

  async updateSurvey(organizerId: string, surveyId: string, patch: SurveyPatchInput): Promise<SurveyDetail> {
    const current = await this.getSurvey(organizerId, surveyId);
    const input: SurveyDraftInput = {
      title: patch.title ?? current.title,
      introduction: patch.introduction ?? current.introduction,
      questions: patch.questions ?? current.questions.map(({ prompt, required, position, warning }) => ({ prompt, required, position, warning })),
      settings: patch.settings ?? current.settings,
    };
    this.assertPhaseOneSettings(input);
    const result = await this.repository.updateSurvey(organizerId, surveyId, input);
    if (result.kind === "not_found") throw notFound("SURVEY_NOT_FOUND");
    if (result.kind === "not_editable") throw new AppError(409, "SURVEY_NOT_EDITABLE", "This survey can no longer be edited.");
    return result.survey;
  }

  async publishSurvey(organizerId: string, surveyId: string): Promise<SurveyDetail> {
    const survey = await this.getSurvey(organizerId, surveyId);
    if (survey.status === "archived" || survey.status === "closed") {
      throw new AppError(409, "INVALID_SURVEY_STATE", "This survey cannot be published from its current state.");
    }
    if (survey.expiresAt && new Date(survey.expiresAt) <= new Date()) {
      throw new AppError(422, "SURVEY_NOT_PUBLISHABLE", "The survey expiry must be in the future.");
    }
    if (survey.status === "open") return survey;
    const published = await this.repository.setSurveyStatus(organizerId, surveyId, "open");
    if (!published) throw notFound("SURVEY_NOT_FOUND");
    return published;
  }

  async closeSurvey(organizerId: string, surveyId: string): Promise<SurveyDetail> {
    const survey = await this.getSurvey(organizerId, surveyId);
    if (survey.status === "closed") return survey;
    if (survey.status !== "open") throw new AppError(409, "INVALID_SURVEY_STATE", "Only an open survey can be closed.");
    const closed = await this.repository.setSurveyStatus(organizerId, surveyId, "closed");
    if (!closed) throw notFound("SURVEY_NOT_FOUND");
    return closed;
  }

  async reopenSurvey(organizerId: string, surveyId: string): Promise<SurveyDetail> {
    const survey = await this.getSurvey(organizerId, surveyId);
    if (survey.status === "open") return survey;
    if (survey.status !== "closed") throw new AppError(409, "INVALID_SURVEY_STATE", "Only a closed survey can be reopened.");
    if (survey.expiresAt && new Date(survey.expiresAt) <= new Date()) {
      throw new AppError(422, "SURVEY_EXPIRED", "Extend the survey expiry before reopening it.");
    }
    const reopened = await this.repository.setSurveyStatus(organizerId, surveyId, "open");
    if (!reopened) throw notFound("SURVEY_NOT_FOUND");
    return reopened;
  }

  async getSurveySummary(organizerId: string, surveyId: string): Promise<SurveySummaryResponse> {
    return await this.repository.getSurveySummary(organizerId, surveyId) ?? (() => { throw notFound("SURVEY_NOT_FOUND"); })();
  }

  async getPublicSurvey(publicToken: string): Promise<PublicSurvey> {
    const result = await this.repository.getPublicSurvey(publicToken);
    if (!result) throw notFound("SURVEY_NOT_FOUND", "This survey link is not available.");
    if (result.expiresAt && result.expiresAt <= new Date()) {
      throw new AppError(410, "SURVEY_UNAVAILABLE", "This survey is no longer available.");
    }
    return result.survey;
  }

  async startResponse(publicToken: string, consentVersion: string, idempotencyKey?: string): Promise<ResponseSession> {
    const requestHash = hashJson({ consentVersion });
    const keyHash = idempotencyKey ? hashValue(idempotencyKey) : null;
    return this.repository.transaction(async (client) => {
      const publicSurvey = await this.repository.getPublicSurvey(publicToken, client);
      if (!publicSurvey) throw notFound("SURVEY_NOT_FOUND", "This survey link is not available.");
      if (publicSurvey.survey.status !== "open") throw new AppError(409, "SURVEY_CLOSED", "This survey is no longer accepting responses.");
      if (publicSurvey.expiresAt && publicSurvey.expiresAt <= new Date()) throw new AppError(410, "SURVEY_EXPIRED", "This survey is no longer accepting responses.");
      if (publicSurvey.accessCodeHash) throw new AppError(401, "INVALID_ACCESS_CODE", "The access code is invalid.");
      if (consentVersion !== publicSurvey.survey.consentVersion) {
        throw new AppError(422, "CONSENT_REQUIRED", "Please accept the current privacy notice.");
      }

      if (keyHash) {
        const lockKey = `public-survey:${publicSurvey.id}:start-response:${keyHash.toString("hex")}`;
        await this.repository.lockIdempotencyScope(client, lockKey);
        const existing = await this.repository.findIdempotency(client, "public_survey", publicSurvey.id, "start_response", keyHash);
        if (existing) {
          if (!existing.request_hash.equals(requestHash)) {
            throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used for a different request.");
          }
          const session = await this.repository.getResponseSessionById(client, existing.resource_id);
          if (!session) throw new AppError(409, "IDEMPOTENCY_RESULT_UNAVAILABLE", "The previous operation result is no longer available.");
          const sessionToken = deriveResponseToken(this.config.tokenDerivationSecret, existing.id, session.client_session_id);
          return { sessionId: session.client_session_id, sessionToken, expiresAt: session.expires_at.toISOString() };
        }
      }

      const operationId = randomUUID();
      const internalId = randomUUID();
      const clientSessionId = randomUUID();
      const sessionToken = keyHash
        ? deriveResponseToken(this.config.tokenDerivationSecret, operationId, clientSessionId)
        : createBearerToken();
      const expiresAt = addMinutes(new Date(), this.config.responseSessionMinutes);
      const publicLabel = await this.repository.nextPublicLabel(client, publicSurvey.id);
      await this.repository.createResponseSession(client, {
        id: internalId,
        clientSessionId,
        surveyId: publicSurvey.id,
        tokenHash: hashValue(sessionToken),
        publicLabel,
        consentVersion,
        expiresAt,
      });
      if (keyHash) {
        await this.repository.createIdempotency(client, {
          id: operationId,
          scopeKind: "public_survey",
          scopeId: publicSurvey.id,
          operation: "start_response",
          keyHash,
          requestHash,
          resourceId: internalId,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_HOURS * 60 * 60 * 1000),
        });
      }
      return { sessionId: clientSessionId, sessionToken, expiresAt: expiresAt.toISOString() };
    });
  }

  async saveAnswer(clientSessionId: string, rawToken: string | undefined, questionId: string, finalText: string): Promise<SaveAnswerResponse> {
    if (!rawToken) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
    return this.repository.transaction(async (client) => {
      const session = await this.repository.getResponseSession(client, clientSessionId, hashValue(rawToken), true);
      if (!session) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
      if (session.expires_at <= new Date()) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "The response session has expired.");
      if (session.status === "submitted") throw new AppError(409, "RESPONSE_ALREADY_SUBMITTED", "This response was already submitted.");
      if (!await this.repository.questionBelongsToSurvey(client, questionId, session.survey_id)) {
        throw notFound("SESSION_OR_QUESTION_NOT_FOUND");
      }
      const savedAt = await this.repository.saveAnswer(client, session.id, questionId, finalText);
      return { questionId, savedAt: savedAt.toISOString() };
    });
  }

  async authorizeTranscriptionSession(clientSessionId: string, rawToken: string | undefined, questionId: string): Promise<void> {
    if (!rawToken) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
    await this.repository.transaction(async (client) => {
      const session = await this.repository.getResponseSession(client, clientSessionId, hashValue(rawToken));
      if (!session) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
      if (session.expires_at <= new Date() || session.status === "submitted" || session.status === "failed") {
        throw new AppError(409, "SESSION_NOT_RECORDABLE", "This response session cannot start another recording.");
      }
      if (!await this.repository.questionBelongsToSurvey(client, questionId, session.survey_id)) {
        throw notFound("SESSION_OR_QUESTION_NOT_FOUND");
      }
    });
  }

  async submitResponse(clientSessionId: string, rawToken: string | undefined, consentVersion: string): Promise<SubmitResponseResult> {
    if (!rawToken) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
    return this.repository.transaction(async (client) => {
      const session = await this.repository.getResponseSession(client, clientSessionId, hashValue(rawToken), true);
      if (!session) throw new AppError(401, "RESPONSE_SESSION_AUTH_REQUIRED", "Response-session access is required.");
      if (session.expires_at <= new Date()) throw new AppError(409, "SURVEY_OR_SESSION_CLOSED", "The response session has expired.");
      if (session.status === "submitted" && session.submitted_at) {
        return { submitted: true, submittedAt: session.submitted_at.toISOString(), publicResponseLabel: session.public_label };
      }
      if (session.consent_version !== consentVersion) throw new AppError(422, "CONSENT_REQUIRED", "Please accept the current privacy notice.");
      const missing = await this.repository.missingRequiredQuestionIds(client, session.id, session.survey_id);
      if (missing.length > 0) {
        throw new AppError(422, "REQUIRED_ANSWERS_MISSING", "Please answer every required question.", { questions: missing.join(",") });
      }
      const submitted = await this.repository.submitResponse(client, session.id);
      return { submitted: true, submittedAt: submitted.submittedAt.toISOString(), publicResponseLabel: submitted.publicLabel };
    });
  }

  private assertPhaseOneSettings(input: SurveyDraftInput): void {
    if (input.settings.hasAccessCode) {
      throw new AppError(422, "ACCESS_CODE_NOT_AVAILABLE", "Access codes are not available in this version.");
    }
    if (input.settings.expiresAt && Number.isNaN(new Date(input.settings.expiresAt).valueOf())) {
      throw new AppError(400, "VALIDATION_ERROR", "The survey expiry is invalid.", { expiresAt: "Invalid date" });
    }
  }
}
