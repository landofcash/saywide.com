import type {
  PolishSurveyTextResponse,
  ApiError,
  CreateReportResponse,
  PublicSurvey,
  ReportResult,
  ReportSummary,
  ResponseSession,
  StartResponseInput,
  SurveyDetail,
  SurveyDraftInput,
  SurveyListResponse,
  TranscriptionSessionResponse,
} from "@saywide/contracts";
import { generatedSurveyDraftSchema, organizerSessionSchema, loginResponseSchema, registerResponseSchema, claimGuestResponseSchema } from "@saywide/contracts";

import {
  completeDraft,
  getDraftAnswers,
  readResponseSession,
  rememberResponseSession,
  saveDraftAnswer,
} from "./participant-session";
import type { SaywideApi } from "./types";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const surveyCache = new Map<string, PublicSurvey>();

class HttpApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "HttpApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/public/") && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event("saywide:auth-expired"));
    }
    let body: ApiError | undefined;
    try {
      body = await response.json() as ApiError;
    } catch {
      // The status text is still useful when a proxy returns a non-JSON error.
    }
    throw new HttpApiError(
      body?.error.message ?? `Request failed: ${response.statusText}`,
      body?.error.code ?? "HTTP_ERROR",
      response.status,
      body?.error.requestId,
    );
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

async function getPublicSurvey(publicToken: string): Promise<PublicSurvey> {
  const survey = await request<PublicSurvey>(`/api/public/s/${encodeURIComponent(publicToken)}`);
  surveyCache.set(publicToken, survey);
  return survey;
}

async function createResponseSession(publicToken: string, input: StartResponseInput): Promise<ResponseSession> {
  const session = await request<ResponseSession>(`/api/public/s/${encodeURIComponent(publicToken)}/sessions`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  });
  rememberResponseSession(publicToken, session, input.consentVersion);
  return session;
}

async function ensureResponseSession(publicToken: string) {
  const current = readResponseSession(publicToken);
  if (current) return current;
  const survey = surveyCache.get(publicToken) ?? await getPublicSurvey(publicToken);
  const session = await createResponseSession(publicToken, { consentVersion: survey.consentVersion });
  return { ...session, consentVersion: survey.consentVersion };
}

export const httpSaywideApi: SaywideApi = {
  async getSession() {
    return organizerSessionSchema.parse(await request("/api/auth/session", { cache: "no-store" }));
  },
  async continueAsGuest() {
    await request("/api/organizer/guest-session", { method: "POST" });
  },
  async logout() {
    await request("/api/auth/logout", { method: "POST" });
  },
  async createOrganizerTranscriptionSession() {
    return request<TranscriptionSessionResponse>("/api/organizer/transcription-sessions", { method: "POST" });
  },

  async polishSurveyText(input) {
    return request<PolishSurveyTextResponse>("/api/organizer/polish-text", {
      method: "POST", body: JSON.stringify(input),
    });
  },
  async listSurveys() {
    return (await request<SurveyListResponse>("/api/organizer/surveys")).items;
  },

  async getSurvey(surveyId) {
    return request<SurveyDetail>(`/api/surveys/${encodeURIComponent(surveyId)}`);
  },

  async draftSurveyFromGoal(transcript, signal) {
    return generatedSurveyDraftSchema.parse(await request("/api/organizer/draft-survey", {
      method: "POST", body: JSON.stringify({ transcript }), signal,
    }));
  },

  async createSurvey(input: SurveyDraftInput) {
    return request<SurveyDetail>("/api/surveys", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    });
  },

  async updateSurvey(surveyId, input) {
    return request<SurveyDetail>(`/api/surveys/${encodeURIComponent(surveyId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async publishSurvey(surveyId) {
    await request(`/api/surveys/${encodeURIComponent(surveyId)}/publish`, { method: "POST" });
    return this.getSurvey(surveyId);
  },

  async changeSurveyStatus(surveyId, status) {
    await request(`/api/surveys/${encodeURIComponent(surveyId)}/${status === "closed" ? "close" : "reopen"}`, {
      method: "POST",
      body: status === "open" ? JSON.stringify({}) : undefined,
    });
    return this.getSurvey(surveyId);
  },

  async listReports(surveyId) {
    return (await request<{ items: ReportSummary[]; nextCursor: string | null }>(
      `/api/surveys/${encodeURIComponent(surveyId)}/reports`,
    )).items;
  },

  async createReport(surveyId, instruction) {
    return request<CreateReportResponse>(`/api/surveys/${encodeURIComponent(surveyId)}/reports`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ instruction }),
    });
  },

  async getReport(reportId) {
    return request<ReportResult>(`/api/reports/${encodeURIComponent(reportId)}`);
  },

  getPublicSurvey,

  async startResponse(publicToken, input) {
    return createResponseSession(publicToken, input);
  },

  async createTranscriptionSession(publicToken, questionId) {
    const session = await ensureResponseSession(publicToken);
    return request<TranscriptionSessionResponse>(
      `/api/public/sessions/${encodeURIComponent(session.sessionId)}/transcription-sessions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({
          questionId,
          languageCode: "en-US",
          mediaEncoding: "pcm",
          sampleRateHertz: 16000,
        }),
      },
    );
  },

  async readAnswers(publicToken) {
    return getDraftAnswers(publicToken);
  },

  async saveAnswer(publicToken, questionId, answer) {
    saveDraftAnswer(publicToken, questionId, answer);
    const session = await ensureResponseSession(publicToken);
    await request(`/api/public/sessions/${encodeURIComponent(session.sessionId)}/answers/${encodeURIComponent(questionId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ finalText: answer, inputMode: "text", audioStatus: "not_used" }),
    });
  },

  async submitResponse(publicToken) {
    const session = await ensureResponseSession(publicToken);
    const answers = getDraftAnswers(publicToken);
    await Promise.all(Object.entries(answers).map(([questionId, answer]) => request(
      `/api/public/sessions/${encodeURIComponent(session.sessionId)}/answers/${encodeURIComponent(questionId)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${session.sessionToken}` },
        body: JSON.stringify({ finalText: answer, inputMode: "text", audioStatus: "not_used" }),
      },
    )));
    const result = await request<{ submittedAt: string }>(`/api/public/sessions/${encodeURIComponent(session.sessionId)}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.sessionToken}` },
      body: JSON.stringify({ consentVersion: session.consentVersion }),
    });
    completeDraft(publicToken, result.submittedAt);
    return { submittedAt: result.submittedAt };
  },

  async register(email, password) {
    await this.continueAsGuest();
    registerResponseSchema.parse(await request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }));
  },

  async login(email, password) {
    return loginResponseSchema.parse(await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
  },

  async claimGuestSurveys() {
    return claimGuestResponseSchema.parse(await request("/api/auth/claim-guest", { method: "POST", body: JSON.stringify({ confirm: true }) }));
  },
};
