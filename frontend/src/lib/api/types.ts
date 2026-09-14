import type {
  OrganizerSession,
  LoginResponse,
  GeneratedSurveyDraft,
  PolishSurveyTextInput,
  PolishSurveyTextResponse,
  ParticipantAnswers,
  PublicSurvey,
  CreateReportResponse,
  ReportResult,
  ReportSummary,
  ResponseSession,
  StartResponseInput,
  SurveyDetail,
  SurveyDraftInput,
  SurveyStatus,
  SurveySummary,
  TranscriptionSessionResponse,
} from "@saywide/contracts";

export interface SaywideApi {
  getSession(): Promise<OrganizerSession>;
  continueAsGuest(): Promise<void>;
  logout(): Promise<void>;
  createOrganizerTranscriptionSession(): Promise<TranscriptionSessionResponse>;
  polishSurveyText(input: PolishSurveyTextInput): Promise<PolishSurveyTextResponse>;
  listSurveys(): Promise<SurveySummary[]>;
  getSurvey(surveyId: string): Promise<SurveyDetail>;
  draftSurveyFromGoal(goal: string, signal?: AbortSignal): Promise<GeneratedSurveyDraft>;
  createSurvey(input: SurveyDraftInput): Promise<SurveyDetail>;
  updateSurvey(surveyId: string, input: SurveyDraftInput): Promise<SurveyDetail>;
  publishSurvey(surveyId: string): Promise<SurveyDetail>;
  changeSurveyStatus(surveyId: string, status: Extract<SurveyStatus, "open" | "closed">): Promise<SurveyDetail>;
  listReports(surveyId: string): Promise<ReportSummary[]>;
  createReport(surveyId: string, instruction: string): Promise<CreateReportResponse>;
  getReport(reportId: string): Promise<ReportResult>;
  getPublicSurvey(publicToken: string): Promise<PublicSurvey>;
  startResponse(publicToken: string, input: StartResponseInput): Promise<ResponseSession>;
  createTranscriptionSession(publicToken: string, questionId: string): Promise<TranscriptionSessionResponse>;
  readAnswers(publicToken: string): Promise<ParticipantAnswers>;
  saveAnswer(publicToken: string, questionId: string, answer: string): Promise<void>;
  submitResponse(publicToken: string): Promise<{ submittedAt: string }>;
  register(email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<LoginResponse>;
  claimGuestSurveys(): Promise<{ transferredSurveyCount: number }>;
}

export interface ApiCapabilities {
  accounts: boolean;
  goalDrafting: boolean;
  reports: boolean;
  voice: boolean;
}
