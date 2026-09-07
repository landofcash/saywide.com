import { surveyStatusSchema } from "@saywide/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import type { SaywideService } from "../services/saywide-service.js";
import { GUEST_COOKIE, requireAllowedOrigin } from "./helpers.js";

const listQuerySchema = z.object({
  status: surveyStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function organizerRoutes(service: SaywideService, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post("/api/organizer/guest-session", {
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      const guest = await service.restoreOrCreateGuest(request.cookies[GUEST_COOKIE]);
      reply.setCookie(GUEST_COOKIE, guest.rawToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.nodeEnv === "production",
        expires: guest.expiresAt,
      });
      return reply.code(guest.created ? 201 : 200).send({
        workspace: {
          kind: "guest" as const,
          recoveryRisk: "browser-bound" as const,
          createdAt: guest.createdAt,
        },
      });
    });

    typed.get("/api/organizer/surveys", {
      schema: { querystring: listQuerySchema },
    }, async (request) => {
      const guest = await service.requireGuest(request.cookies[GUEST_COOKIE]);
      const items = await service.listSurveys(guest.organizerId, request.query.status, request.query.limit);
      return { items, nextCursor: null };
    });
  };
}
