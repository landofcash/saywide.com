import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { Pool } from "pg";

import type { AppConfig } from "./config.js";
import databasePlugin from "./plugins/database.js";
import { AppError } from "./errors.js";
import { SaywideRepository } from "./repositories/saywide-repository.js";
import { ReportRepository } from "./repositories/report-repository.js";
import { healthRoutes } from "./routes/health.js";
import { organizerRoutes } from "./routes/organizer.js";
import { organizerWritingRoutes } from "./routes/organizer-writing.js";
import { OpenAiSurveyTextPolisher, type SurveyTextPolisher } from "./services/survey-text-polisher.js";
import { publicRoutes } from "./routes/public.js";
import { reportRoutes } from "./routes/reports.js";
import { surveyRoutes } from "./routes/surveys.js";
import { StrandsReportAnalyzer, type ReportAnalyzer } from "./services/report-analyzer.js";
import { ReportService } from "./services/report-service.js";
import { SaywideService } from "./services/saywide-service.js";
import {
  AwsTranscriptionSessionSigner,
  type TranscriptionSessionSigner,
} from "./services/transcribe-session-signer.js";

export interface BuildAppOptions {
  config: AppConfig;
  pool?: Pool;
  transcriptionSessionSigner?: TranscriptionSessionSigner;
  reportAnalyzer?: ReportAnalyzer;
  surveyTextPolisher?: SurveyTextPolisher;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger: {
      level: options.config.logLevel,
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
        censor: "[REDACTED]",
      },
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    maxAge: 86_400,
    strictPreflight: true,
    origin(origin, callback) {
      callback(null, !origin || options.config.frontendOrigins.includes(origin.replace(/\/$/, "")));
    },
  });
  app.register(cookie);
  app.register(helmet);
  app.register(rateLimit, { global: false });
  app.register(databasePlugin, { config: options.config, pool: options.pool });

  app.register(async (scope) => {
    const service = new SaywideService(new SaywideRepository(scope.db), options.config);
    const transcriptionSessionSigner = options.transcriptionSessionSigner
      ?? new AwsTranscriptionSessionSigner(options.config);
    const reportService = new ReportService(
      new ReportRepository(scope.db),
      options.reportAnalyzer ?? new StrandsReportAnalyzer(options.config),
      options.config,
    );
    scope.addHook("onReady", async () => {
      const queuedRequestIds = await reportService.queuedRequestIds();
      for (const requestId of queuedRequestIds) {
        setImmediate(() => {
          void reportService.process(requestId).catch(() => {
            scope.log.warn({ reportId: requestId, errorCode: "REPORT_PROCESSING_FAILED" }, "Queued report processing failed");
          });
        });
      }
    });
    scope.register(healthRoutes(service));
    scope.register(organizerRoutes(service, options.config));
    scope.register(organizerWritingRoutes(service, transcriptionSessionSigner,
      options.surveyTextPolisher ?? new OpenAiSurveyTextPolisher(options.config), options.config));
    scope.register(surveyRoutes(service, options.config));
    scope.register(reportRoutes(service, reportService, options.config));
    scope.register(publicRoutes(service, transcriptionSessionSigner, options.config));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested resource was not found.",
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as { validation?: unknown; statusCode?: number };
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
    }
    if (fastifyError.validation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request could not be processed.",
          requestId: request.id,
        },
      });
    }
    if (fastifyError.statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          requestId: request.id,
        },
      });
    }
    request.log.error({ code: "UNEXPECTED_ERROR", statusCode: 500 }, "Unhandled request error");
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId: request.id,
      },
    });
  });

  return app;
}
