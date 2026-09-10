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
let guestSession: Promise<void> | undefined;

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
  return response.json() as Promise<T>;
}

async function ensureGuestSession(): Promise<void> {
  guestSession ??= request("/api/organizer/guest-session", { method: "POST" }).then(() => undefined).catch((error) => {
    guestSession = undefined;
    throw error;
  });
  return guestSession;
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

function unavailable(feature: string): never {
  throw new Error(`${feature} is available in demo mode and is not part of the live Phase 1 backend.`);
}

export const httpSaywideApi: SaywideApi = {
  async createOrganizerTranscriptionSession() {
    await ensureGuestSession();
    return request<TranscriptionSessionResponse>("/api/organizer/transcription-sessions", { method: "POST" });
  },

  async polishSurveyText(input) {
    await ensureGuestSession();
    return request<PolishSurveyTextResponse>("/api/organizer/polish-text", {
      method: "POST", body: JSON.stringify(input),
    });
  },
  async listSurveys() {
    await ensureGuestSession();
    return (await request<SurveyListResponse>("/api/organizer/surveys")).items;
  },

  async getSurvey(surveyId) {
    await ensureGuestSession();
    return request<SurveyDetail>(`/api/surveys/${encodeURIComponent(surveyId)}`);
  },

  async draftSurveyFromGoal() {
    return unavailable("Goal-based survey drafting");
  },

  async createSurvey(input: SurveyDraftInput) {
    await ensureGuestSession();
    return request<SurveyDetail>("/api/surveys", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    });
  },

  async updateSurvey(surveyId, input) {
    await ensureGuestSession();
    return request<SurveyDetail>(`/api/surveys/${encodeURIComponent(surveyId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  async publishSurvey(surveyId) {
    await ensureGuestSession();
    await request(`/api/surveys/${encodeURIComponent(surveyId)}/publish`, { method: "POST" });
    return this.getSurvey(surveyId);
  },

  async changeSurveyStatus(surveyId, status) {
    await ensureGuestSession();
    await request(`/api/surveys/${encodeURIComponent(surveyId)}/${status === "closed" ? "close" : "reopen"}`, {
      method: "POST",
      body: status === "open" ? JSON.stringify({}) : undefined,
    });
    return this.getSurvey(surveyId);
  },

  async listReports(surveyId) {
    await ensureGuestSession();
    return (await request<{ items: ReportSummary[]; nextCursor: string | null }>(
      `/api/surveys/${encodeURIComponent(surveyId)}/reports`,
    )).items;
  },

  async createReport(surveyId, instruction) {
    await ensureGuestSession();
    return request<CreateReportResponse>(`/api/surveys/${encodeURIComponent(surveyId)}/reports`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ instruction }),
    });
  },

  async getReport(reportId) {
    await ensureGuestSession();
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

  async register() {
    return unavailable("Accounts");
  },

  async login() {
    return unavailable("Accounts");
  },

  async claimGuestSurveys() {
    return unavailable("Accounts");
  },
};
