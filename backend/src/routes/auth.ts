import { claimGuestInputSchema, claimGuestResponseSchema, loginInputSchema, loginResponseSchema, organizerSessionSchema, registerInputSchema, registerResponseSchema } from "@saywide/contracts";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../config.js";
import type { AuthService } from "../services/auth-service.js";
import { ACCOUNT_COOKIE, GUEST_COOKIE, requireAllowedOrigin } from "./helpers.js";

export function authRoutes(auth: AuthService, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();
    app.addHook("onRequest", async (_request, reply) => { reply.header("Cache-Control", "no-store"); });
    const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: config.nodeEnv === "production" };
    function setAccount(reply: FastifyReply, issued: { rawToken: string; expiresAt: Date }) {
      reply.setCookie(ACCOUNT_COOKIE, issued.rawToken, { ...cookieOptions, expires: issued.expiresAt });
    }
    typed.get("/api/auth/session", { schema: { response: { 200: organizerSessionSchema } } }, (request) => auth.session(request.cookies));
    typed.post("/api/auth/register", {
      schema: { body: registerInputSchema, response: { 201: registerResponseSchema } },
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      setAccount(reply, await auth.register(request.cookies, request.body.email, request.body.password));
      reply.clearCookie(GUEST_COOKIE, cookieOptions);
      return reply.code(201).send({ workspace: { kind: "registered" } });
    });
    typed.post("/api/auth/login", {
      schema: { body: loginInputSchema, response: { 200: loginResponseSchema } },
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      const result = await auth.login(request.cookies, request.body.email, request.body.password);
      setAccount(reply, result);
      return { workspace: { kind: "registered" as const }, guestWorkspacePending: result.guestWorkspacePending };
    });
    typed.post("/api/auth/claim-guest", {
      schema: { body: claimGuestInputSchema, response: { 200: claimGuestResponseSchema } },
    }, async (request, reply) => {
      requireAllowedOrigin(request, config);
      const result = await auth.claim(request.cookies, request.body.confirm);
      reply.clearCookie(GUEST_COOKIE, cookieOptions);
      return result;
    });
    typed.post("/api/auth/logout", async (request, reply) => {
      requireAllowedOrigin(request, config);
      await auth.logout(request.cookies);
      reply.clearCookie(ACCOUNT_COOKIE, cookieOptions);
      return reply.code(204).send();
    });
  };
}
