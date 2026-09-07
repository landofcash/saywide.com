import { z } from "zod";

export const surveyStatusSchema = z.enum(["draft", "open", "closed", "archived"]);
export type SurveyStatus = z.infer<typeof surveyStatusSchema>;

export const reportStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const questionSchema = z.object({
  questionId: z.string(),
  prompt: z.string().trim().min(1).max(1000),
  required: z.boolean(),
  position: z.number().int().min(0).max(4),
  warning: z.string().optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const surveySettingsSchema = z.object({
  expiresAt: z.string().nullable(),
  hasAccessCode: z.boolean(),
  minReportResponses: z.number().int().positive(),
});
export type SurveySettings = z.infer<typeof surveySettingsSchema>;

export const surveySummarySchema = z.object({
  surveyId: z.string(),
  title: z.string(),
  status: surveyStatusSchema,
  questionCount: z.number().int().nonnegative(),
  submittedResponseCount: z.number().int().nonnegative(),
  reportState: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SurveySummary = z.infer<typeof surveySummarySchema>;

export const surveyDetailSchema = surveySummarySchema.extend({
  introduction: z.string(),
  questions: z.array(questionSchema).min(1).max(5),
  settings: surveySettingsSchema,
  publicToken: z.string().nullable(),
  participantUrl: z.string().nullable(),
  startedResponseCount: z.number().int().nonnegative(),
  lastSubmittedAt: z.string().nullable(),
});
export type SurveyDetail = z.infer<typeof surveyDetailSchema>;

export const surveyDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  introduction: z.string().trim().max(2000),
  questions: z.array(questionSchema.omit({ questionId: true })).min(1).max(5),
  settings: surveySettingsSchema.extend({
    minReportResponses: z.number().int().min(1).max(50),
  }),
});
export type SurveyDraftInput = z.infer<typeof surveyDraftInputSchema>;

export const surveyPatchInputSchema = surveyDraftInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one survey field is required.",
);
export type SurveyPatchInput = z.infer<typeof surveyPatchInputSchema>;

export const reportSummarySchema = z.object({
  reportId: z.string(),
  surveyId: z.string(),
  instruction: z.string(),
  status: reportStatusSchema,
  snapshotAt: z.string(),
  eligibleResponseCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

export const evidenceSchema = z.object({
  label: z.string(),
  excerpt: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const findingSchema = z.object({
  findingId: z.string(),
  title: z.string(),
  category: z.enum(["strength", "friction", "minority-view", "opportunity"]),
  summary: z.string(),
  supportCount: z.number().int().nonnegative(),
  supportPercentage: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "emerging"]),
  suggestedAction: z.string(),
  evidence: z.array(evidenceSchema),
});
export type Finding = z.infer<typeof findingSchema>;

export const reportSchema = reportSummarySchema.extend({
  surveyTitle: z.string(),
  limitations: z.array(z.string()),
  findings: z.array(findingSchema),
  minorityViews: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
});
export type Report = z.infer<typeof reportSchema>;

export const publicSurveySchema = z.object({
  publicToken: z.string(),
  title: z.string(),
  introduction: z.string(),
  status: surveyStatusSchema,
  questions: z.array(questionSchema),
  estimatedMinutes: z.number().int().positive(),
  requiresAccessCode: z.boolean(),
  consentVersion: z.string(),
});
export type PublicSurvey = z.infer<typeof publicSurveySchema>;

export const responseSessionSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string().min(1),
  expiresAt: z.string(),
});
export type ResponseSession = z.infer<typeof responseSessionSchema>;

export type ParticipantAnswers = Record<string, string>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const healthResponseSchema = z.object({ status: z.enum(["ok", "unavailable"]) });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const guestWorkspaceSchema = z.object({
  workspace: z.object({
    kind: z.literal("guest"),
    recoveryRisk: z.literal("browser-bound"),
    createdAt: z.string(),
  }),
});
export type GuestWorkspace = z.infer<typeof guestWorkspaceSchema>;

export const surveyListResponseSchema = z.object({
  items: z.array(surveySummarySchema),
  nextCursor: z.string().nullable(),
});
export type SurveyListResponse = z.infer<typeof surveyListResponseSchema>;

export const publishSurveyResponseSchema = z.object({
  surveyId: z.string(),
  status: z.literal("open"),
  shareUrl: z.string(),
  publicToken: z.string(),
  expiresAt: z.string().nullable(),
});
export type PublishSurveyResponse = z.infer<typeof publishSurveyResponseSchema>;

export const surveyStatusResponseSchema = z.object({
  surveyId: z.string(),
  status: z.enum(["open", "closed"]),
  shareUrl: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});
export type SurveyStatusResponse = z.infer<typeof surveyStatusResponseSchema>;

export const surveySummaryResponseSchema = z.object({
  surveyId: z.string(),
  status: surveyStatusSchema,
  startedResponseCount: z.number().int().nonnegative(),
  submittedResponseCount: z.number().int().nonnegative(),
  reportEligible: z.boolean(),
  minReportResponses: z.number().int().positive(),
  expiresAt: z.string().nullable(),
  lastSubmittedAt: z.string().nullable(),
});
export type SurveySummaryResponse = z.infer<typeof surveySummaryResponseSchema>;

export const startResponseInputSchema = z.object({
  consentVersion: z.string().trim().min(1).max(64),
  accessCode: z.string().max(128).optional(),
});
export type StartResponseInput = z.infer<typeof startResponseInputSchema>;

export const saveAnswerInputSchema = z.object({
  finalText: z.string().max(10000),
  inputMode: z.literal("text"),
  audioStatus: z.literal("not_used"),
});
export type SaveAnswerInput = z.infer<typeof saveAnswerInputSchema>;

export const saveAnswerResponseSchema = z.object({
  questionId: z.string(),
  savedAt: z.string(),
});
export type SaveAnswerResponse = z.infer<typeof saveAnswerResponseSchema>;

export const submitResponseInputSchema = z.object({
  consentVersion: z.string().trim().min(1).max(64),
});
export type SubmitResponseInput = z.infer<typeof submitResponseInputSchema>;

export const submitResponseResultSchema = z.object({
  submitted: z.literal(true),
  submittedAt: z.string(),
  publicResponseLabel: z.string(),
});
export type SubmitResponseResult = z.infer<typeof submitResponseResultSchema>;
