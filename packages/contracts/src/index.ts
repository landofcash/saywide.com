import { z } from "zod";

export const surveyStatusSchema = z.enum(["draft", "open", "closed", "archived"]);
export type SurveyStatus = z.infer<typeof surveyStatusSchema>;

export const reportStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const questionSchema = z.object({
  questionId: z.string(),
  prompt: z.string().min(1),
  required: z.boolean(),
  position: z.number().int().nonnegative(),
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
  title: z.string().min(1),
  introduction: z.string(),
  questions: z.array(questionSchema.omit({ questionId: true })).min(1).max(5),
  settings: surveySettingsSchema,
});
export type SurveyDraftInput = z.infer<typeof surveyDraftInputSchema>;

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
  expiresAt: z.string(),
});
export type ResponseSession = z.infer<typeof responseSessionSchema>;

export type ParticipantAnswers = Record<string, string>;
