import type {
  ParticipantAnswers,
  Report,
  StartResponseInput,
  SurveyDetail,
  SurveyDraftInput,
  SurveySummary,
} from "@saywide/contracts";

import { createInitialState, type MockState } from "./mock-data";
import type { SaywideApi } from "./types";

const STATE_KEY = "saywide.mock-state.v1";
const RESPONSE_PREFIX = "saywide.response.";

const pause = (milliseconds = 160) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function readState(): MockState {
  if (typeof window === "undefined") return createInitialState();
  const stored = window.localStorage.getItem(STATE_KEY);
  if (!stored) {
    const initial = createInitialState();
    window.localStorage.setItem(STATE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(stored) as MockState;
  } catch {
    const initial = createInitialState();
    window.localStorage.setItem(STATE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function writeState(state: MockState) {
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function summary(survey: SurveyDetail): SurveySummary {
  const { surveyId, title, status, questionCount, submittedResponseCount, reportState, expiresAt, createdAt, updatedAt } = survey;
  return { surveyId, title, status, questionCount, submittedResponseCount, reportState, expiresAt, createdAt, updatedAt };
}

function getStoredAnswers(token: string): ParticipantAnswers {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(`${RESPONSE_PREFIX}${token}.draft`) ?? "{}") as ParticipantAnswers;
  } catch {
    return {};
  }
}

function findSurvey(state: MockState, surveyId: string) {
  const survey = state.surveys.find((item) => item.surveyId === surveyId);
  if (!survey) throw new Error("Survey not found");
  return survey;
}

function makeSurvey(input: SurveyDraftInput, surveyId = `survey-${Date.now()}`): SurveyDetail {
  const now = new Date().toISOString();
  return {
    ...input,
    surveyId,
    status: "draft",
    questions: input.questions.map((question, index) => ({ ...question, questionId: `q-${surveyId}-${index + 1}` })),
    questionCount: input.questions.length,
    submittedResponseCount: 0,
    startedResponseCount: 0,
    reportState: "Not started",
    expiresAt: input.settings.expiresAt,
    publicToken: null,
    participantUrl: null,
    lastSubmittedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const mockSaywideApi: SaywideApi = {
  async listSurveys() {
    await pause();
    return readState().surveys.map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getSurvey(surveyId) {
    await pause();
    return structuredClone(findSurvey(readState(), surveyId));
  },

  async draftSurveyFromGoal(goal) {
    await pause(500);
    const state = readState();
    const input: SurveyDraftInput = {
      title: goal.toLowerCase().includes("event") ? "Event experience reflection" : "Team experience check-in",
      introduction: "Share your perspective in your own words. Your response is anonymous and will be reviewed as part of a combined report.",
      questions: [
        { prompt: "What has been working especially well?", required: true, position: 0 },
        { prompt: "What has made the experience more difficult than it should be?", required: true, position: 1 },
        { prompt: "What is one practical change you would make next?", required: true, position: 2 },
      ],
      settings: { expiresAt: null, hasAccessCode: false, minReportResponses: 2 },
    };
    const survey = makeSurvey(input);
    state.surveys.unshift(survey);
    writeState(state);
    return structuredClone(survey);
  },

  async createSurvey(input) {
    await pause();
    const state = readState();
    const survey = makeSurvey(input);
    state.surveys.unshift(survey);
    writeState(state);
    return structuredClone(survey);
  },

  async updateSurvey(surveyId, input) {
    await pause();
    const state = readState();
    const survey = findSurvey(state, surveyId);
    Object.assign(survey, input, {
      questions: input.questions.map((question, index) => ({
        ...question,
        questionId: survey.questions[index]?.questionId ?? `q-${surveyId}-${index + 1}`,
      })),
      questionCount: input.questions.length,
      expiresAt: input.settings.expiresAt,
      updatedAt: new Date().toISOString(),
    });
    writeState(state);
    return structuredClone(survey);
  },

  async publishSurvey(surveyId) {
    await pause(280);
    const state = readState();
    const survey = findSurvey(state, surveyId);
    survey.status = "open";
    survey.publicToken ??= survey.surveyId === "team-retro" ? "team-voices" : `share-${survey.surveyId}`;
    survey.participantUrl = `/s/${survey.publicToken}`;
    survey.updatedAt = new Date().toISOString();
    writeState(state);
    return structuredClone(survey);
  },

  async changeSurveyStatus(surveyId, status) {
    await pause();
    const state = readState();
    const survey = findSurvey(state, surveyId);
    survey.status = status;
    survey.updatedAt = new Date().toISOString();
    writeState(state);
    return structuredClone(survey);
  },

  async listReports(surveyId) {
    await pause();
    return readState().reports.filter((report) => report.surveyId === surveyId).map((report) => ({
      reportId: report.reportId,
      surveyId: report.surveyId,
      instruction: report.instruction,
      status: report.status,
      snapshotAt: report.snapshotAt,
      eligibleResponseCount: report.eligibleResponseCount,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
    }));
  },

  async createReport(surveyId, instruction) {
    await pause(600);
    const state = readState();
    const survey = findSurvey(state, surveyId);
    const template = state.reports[0];
    const now = new Date().toISOString();
    const report: Report = {
      ...structuredClone(template),
      reportId: `report-${Date.now()}`,
      surveyId,
      surveyTitle: survey.title,
      instruction,
      eligibleResponseCount: survey.submittedResponseCount,
      snapshotAt: now,
      createdAt: now,
      completedAt: now,
    };
    state.reports.unshift(report);
    survey.reportState = "Complete";
    writeState(state);
    return report;
  },

  async getReport(reportId) {
    await pause(300);
    const report = readState().reports.find((item) => item.reportId === reportId);
    if (!report) throw new Error("Report not found");
    return structuredClone(report);
  },

  async getPublicSurvey(publicToken) {
    await pause();
    const survey = readState().surveys.find((item) => item.publicToken === publicToken);
    if (!survey) throw new Error("This survey link is not available.");
    return {
      publicToken,
      title: survey.title,
      introduction: survey.introduction,
      status: survey.status,
      questions: structuredClone(survey.questions),
      estimatedMinutes: Math.max(2, survey.questions.length * 2),
      requiresAccessCode: survey.settings.hasAccessCode,
      consentVersion: "2026-09-01",
    };
  },

  async startResponse(publicToken, input: StartResponseInput) {
    void input;
    await pause();
    const publicSurvey = await this.getPublicSurvey(publicToken);
    if (publicSurvey.status !== "open") throw new Error("This survey is no longer accepting responses.");
    return {
      sessionId: `session-${Date.now()}`,
      sessionToken: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  },

  async createTranscriptionSession() {
    throw new Error("Live voice transcription is not used by the synthetic demo.");
  },

  async readAnswers(publicToken) {
    await pause(40);
    return getStoredAnswers(publicToken);
  },

  async saveAnswer(publicToken, questionId, answer) {
    await pause(60);
    const answers = getStoredAnswers(publicToken);
    answers[questionId] = answer;
    window.localStorage.setItem(`${RESPONSE_PREFIX}${publicToken}.draft`, JSON.stringify(answers));
  },

  async submitResponse(publicToken) {
    await pause(350);
    const submittedAt = new Date().toISOString();
    window.localStorage.removeItem(`${RESPONSE_PREFIX}${publicToken}.draft`);
    window.localStorage.setItem(`${RESPONSE_PREFIX}${publicToken}.submitted`, submittedAt);
    return { submittedAt };
  },

  async register(email, password) {
    void email;
    void password;
    await pause(350);
  },

  async login(email, password) {
    void email;
    void password;
    await pause(350);
    return { hasGuestSurveys: true };
  },

  async claimGuestSurveys() {
    await pause(400);
    return { transferredSurveyCount: readState().surveys.length };
  },
};
