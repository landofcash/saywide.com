import { createHash, createHmac, randomBytes } from "node:crypto";

export function createBearerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashValue(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hashJson(value: unknown): Buffer {
  return hashValue(JSON.stringify(value));
}

export function deriveResponseToken(secret: string, operationId: string, sessionId: string): string {
  return createHmac("sha256", secret)
    .update(`response-session:v1:${operationId}:${sessionId}`, "utf8")
    .digest("base64url");
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
