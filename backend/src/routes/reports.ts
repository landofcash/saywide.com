import { createReportInputSchema } from "@saywide/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import type { SaywideService } from "../services/saywide-service.js";
import type { ReportService } from "../services/report-service.js";
import { GUEST_COOKIE, idempotencyKey, requireAllowedOrigin } from "./helpers.js";

const surveyParamsSchema = z.object({ surveyId: z.string().uuid() });
const reportParamsSchema = z.object({ reportId: z.string().uuid() });
const listQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

export function reportRoutes(
  organizerService: SaywideService,
  reportService: ReportService,
  config: AppConfig,
): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.get("/api/surveys/:surveyId/reports", {
      schema: { params: surveyParamsSchema, querystring: listQuerySchema },
    }, async (request) => {
      const guest = await organizerService.requireGuest(request.cookies[GUEST_COOKIE]);
      const items = await reportService.list(guest.organizerId, request.params.surveyId, request.query.limit);
      return { items, nextCursor: null };
    });

    typed.post("/api/surveys/:surveyId/reports", {
      schema: { params: surveyParamsSchema, body: createReportInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      const guest = await organizerService.requireGuest(request.cookies[GUEST_COOKIE]);
      const accepted = await reportService.create(
        guest.organizerId,
        request.params.surveyId,
        request.body.instruction,
        idempotencyKey(request),
      );
      setImmediate(() => {
        void reportService.process(accepted.reportRequestId).catch(() => {
          request.log.warn({ reportId: accepted.reportId, errorCode: "REPORT_PROCESSING_FAILED" }, "Report processing failed");
        });
      });
      return reply.code(202).send(accepted);
    });

    typed.get("/api/reports/:reportId", {
      schema: { params: reportParamsSchema },
    }, async (request, reply) => {
      const guest = await organizerService.requireGuest(request.cookies[GUEST_COOKIE]);
      reply.header("Cache-Control", "private, no-store");
      return reportService.get(guest.organizerId, request.params.reportId);
    });
  };
}
