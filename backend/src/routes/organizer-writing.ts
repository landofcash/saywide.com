import { draftSurveyFromGoalInputSchema, generatedSurveyDraftSchema, polishSurveyTextInputSchema, polishSurveyTextResponseSchema } from "@saywide/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import type { SaywideService } from "../services/saywide-service.js";
import type { SurveyTextPolisher } from "../services/survey-text-polisher.js";
import type { SurveyDraftGenerator } from "../services/survey-draft-generator.js";
import type { TranscriptionSessionSigner } from "../services/transcribe-session-signer.js";
import { requireAllowedOrigin } from "./helpers.js";

export function organizerWritingRoutes(
  service: Pick<SaywideService, "requireOrganizer">,
  signer: TranscriptionSessionSigner,
  polisher: SurveyTextPolisher,
  config: AppConfig,
  generator: SurveyDraftGenerator,
): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();
    typed.addHook("preHandler", async (request) => {
      requireAllowedOrigin(request, config);
      await service.requireOrganizer(request.cookies);
    });

    typed.post("/api/organizer/transcription-sessions", {
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    }, async (_request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      try {
        return await signer.issueSession();
      } catch {
        throw new AppError(503, "TRANSCRIPTION_UNAVAILABLE", "Voice input is unavailable right now. You can continue by typing.");
      }
    });

    typed.post("/api/organizer/polish-text", {
      schema: { body: polishSurveyTextInputSchema, response: { 200: polishSurveyTextResponseSchema } },
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      try {
        return await polisher.polish(request.body);
      } catch {
        throw new AppError(503, "POLISH_UNAVAILABLE", "AI polishing is unavailable right now. Your original text is unchanged.");
      }
    });

    typed.post("/api/organizer/draft-survey", {
      schema: { body: draftSurveyFromGoalInputSchema, response: { 200: generatedSurveyDraftSchema } },
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      try {
        return generatedSurveyDraftSchema.parse(await generator.generate(request.body.transcript));
      } catch (error) {
        if (error instanceof AppError && error.code === "SURVEY_DESCRIPTION_INSUFFICIENT") throw error;
        throw new AppError(503, "SURVEY_GENERATION_UNAVAILABLE", "We could not prepare your survey. Try again or record a new description.");
      }
    });
  };
}
