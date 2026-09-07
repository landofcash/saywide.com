import type { FastifyPluginAsync } from "fastify";

import type { SaywideService } from "../services/saywide-service.js";

export function healthRoutes(service: SaywideService): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/health", async (_request, reply) => {
      try {
        await service.health();
        return { status: "ok" as const };
      } catch {
        return reply.code(503).send({ status: "unavailable" as const });
      }
    });
  };
}
