import { saveAnswerInputSchema, startResponseInputSchema, submitResponseInputSchema } from "@saywide/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { SaywideService } from "../services/saywide-service.js";
import { bearerToken, idempotencyKey } from "./helpers.js";

const publicParamsSchema = z.object({ publicToken: z.string().min(16).max(128) });
const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });
const answerParamsSchema = sessionParamsSchema.extend({ questionId: z.string().uuid() });

export function publicRoutes(service: SaywideService): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.get("/api/public/s/:publicToken", {
      schema: { params: publicParamsSchema },
    }, async (request) => service.getPublicSurvey(request.params.publicToken));

    typed.post("/api/public/s/:publicToken/sessions", {
      schema: { params: publicParamsSchema, body: startResponseInputSchema },
      config: { rateLimit: { max: 60, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      const session = await service.startResponse(request.params.publicToken, request.body.consentVersion, idempotencyKey(request));
      reply.header("Cache-Control", "no-store");
      return reply.code(201).send(session);
    });

    typed.put("/api/public/sessions/:sessionId/answers/:questionId", {
      schema: { params: answerParamsSchema, body: saveAnswerInputSchema },
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    }, async (request) => service.saveAnswer(
      request.params.sessionId,
      bearerToken(request),
      request.params.questionId,
      request.body.finalText,
    ));

    typed.post("/api/public/sessions/:sessionId/submit", {
      schema: { params: sessionParamsSchema, body: submitResponseInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    }, async (request) => service.submitResponse(
      request.params.sessionId,
      bearerToken(request),
      request.body.consentVersion,
    ));
  };
}
