import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:3000"),
  TOKEN_DERIVATION_SECRET: z.string().min(32),
  GUEST_CREDENTIAL_DAYS: z.coerce.number().int().min(1).max(730).default(365),
  RESPONSE_SESSION_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AWS_REGION: z.string().trim().min(1).default("us-east-1"),
  AWS_PROFILE: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  TRANSCRIBE_LANGUAGE_CODE: z.literal("en-US").default("en-US"),
  TRANSCRIBE_SIGNED_URL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
  TRANSCRIBE_RECORDING_LIMIT_SECONDS: z.coerce.number().int().min(15).max(300).default(120),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  publicAppUrl: string;
  frontendOrigins: string[];
  tokenDerivationSecret: string;
  guestCredentialDays: number;
  responseSessionMinutes: number;
  awsRegion: string;
  awsProfile?: string;
  transcribeLanguageCode: "en-US";
  transcribeSignedUrlSeconds: number;
  transcribeRecordingLimitSeconds: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    publicAppUrl: parsed.PUBLIC_APP_URL.replace(/\/$/, ""),
    frontendOrigins: parsed.FRONTEND_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean),
    tokenDerivationSecret: parsed.TOKEN_DERIVATION_SECRET,
    guestCredentialDays: parsed.GUEST_CREDENTIAL_DAYS,
    responseSessionMinutes: parsed.RESPONSE_SESSION_MINUTES,
    awsRegion: parsed.AWS_REGION,
    awsProfile: parsed.AWS_PROFILE,
    transcribeLanguageCode: parsed.TRANSCRIBE_LANGUAGE_CODE,
    transcribeSignedUrlSeconds: parsed.TRANSCRIBE_SIGNED_URL_SECONDS,
    transcribeRecordingLimitSeconds: parsed.TRANSCRIBE_RECORDING_LIMIT_SECONDS,
    logLevel: parsed.LOG_LEVEL,
  };
}
