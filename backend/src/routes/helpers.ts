import type { FastifyRequest } from "fastify";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";

export const GUEST_COOKIE = "saywide_guest";
export const ACCOUNT_COOKIE = "saywide_account";

export function requireAllowedOrigin(request: FastifyRequest, config: AppConfig): void {
  const origin = request.headers.origin;
  if (!origin || !config.frontendOrigins.includes(origin.replace(/\/$/, ""))) {
    throw new AppError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
  }
}

export function idempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers["idempotency-key"];
  const key = Array.isArray(value) ? value[0] : value;
  if (!key) return undefined;
  if (key.length > 200) throw new AppError(400, "VALIDATION_ERROR", "The idempotency key is too long.");
  return key;
}

export function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
}
