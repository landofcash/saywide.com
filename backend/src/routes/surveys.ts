import { surveyDraftInputSchema, surveyPatchInputSchema } from "@saywide/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import type { SaywideService } from "../services/saywide-service.js";
import { idempotencyKey, requireAllowedOrigin } from "./helpers.js";

const paramsSchema = z.object({ surveyId: z.string().uuid() });

export function surveyRoutes(service: SaywideService, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post("/api/surveys", {
      schema: { body: surveyDraftInputSchema },
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      const guest = await service.requireOrganizer(request.cookies);
      const survey = await service.createSurvey(guest.organizerId, request.body, idempotencyKey(request), guest);
      return reply.code(201).send(survey);
    });

    typed.get("/api/surveys/:surveyId", {
      schema: { params: paramsSchema },
    }, async (request) => {
      const guest = await service.requireOrganizer(request.cookies);
      return service.getSurvey(guest.organizerId, request.params.surveyId);
    });

    typed.patch("/api/surveys/:surveyId", {
      schema: { params: paramsSchema, body: surveyPatchInputSchema },
    }, async (request) => {
      requireAllowedOrigin(request, config);
      const guest = await service.requireOrganizer(request.cookies);
      return service.updateSurvey(guest.organizerId, request.params.surveyId, request.body, guest);
    });

    typed.post("/api/surveys/:surveyId/publish", {
      schema: { params: paramsSchema },
    }, async (request) => {
      requireAllowedOrigin(request, config);
      const guest = await service.requireOrganizer(request.cookies);
      const survey = await service.publishSurvey(guest.organizerId, request.params.surveyId, guest);
      return {
        surveyId: survey.surveyId,
        status: "open" as const,
        shareUrl: `${config.publicAppUrl}${survey.participantUrl}`,
        publicToken: survey.publicToken!,
        expiresAt: survey.expiresAt,
      };
    });

    typed.post("/api/surveys/:surveyId/close", {
      schema: { params: paramsSchema },
    }, async (request) => {
      requireAllowedOrigin(request, config);
      const guest = await service.requireOrganizer(request.cookies);
      const survey = await service.closeSurvey(guest.organizerId, request.params.surveyId, guest);
      return { surveyId: survey.surveyId, status: "closed" as const };
    });

    typed.post("/api/surveys/:surveyId/reopen", {
      schema: { params: paramsSchema, body: z.object({ expiresAt: z.string().datetime().optional() }).optional() },
    }, async (request) => {
      requireAllowedOrigin(request, config);
      const guest = await service.requireOrganizer(request.cookies);
      const survey = await service.reopenSurvey(guest.organizerId, request.params.surveyId, guest);
      return {
        surveyId: survey.surveyId,
        status: "open" as const,
        shareUrl: `${config.publicAppUrl}${survey.participantUrl}`,
        expiresAt: survey.expiresAt,
      };
    });

    typed.get("/api/surveys/:surveyId/summary", {
      schema: { params: paramsSchema },
    }, async (request) => {
      const guest = await service.requireOrganizer(request.cookies);
      return service.getSurveySummary(guest.organizerId, request.params.surveyId);
    });
  };
}
