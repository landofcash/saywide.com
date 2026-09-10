# Saywide backend

This directory implements the anonymous-text and report APIs described in
[`docs/api-endpoints.md`](../docs/api-endpoints.md): health, guest workspaces,
manual survey CRUD/status, participant-safe survey reads, response sessions,
answer upserts, submission, short-lived Amazon Transcribe Streaming
authorization, and the Phase 2 evidence-backed report workflow.

The frontend never imports backend implementation code. Shared browser-safe
schemas live in `packages/contracts`.

## Local setup

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
docker compose up -d postgres
corepack pnpm db:migrate
corepack pnpm dev:backend
```

The default development database is a dedicated PostgreSQL 18 container at
`127.0.0.1:5433`; it does not reuse another local PostgreSQL service. Replace
the development-only secret and database credentials before any deployment.
For local voice testing, authenticate the AWS CLI profile configured by
`AWS_PROFILE`. In Railway, omit `AWS_PROFILE` and provide runtime credentials
with `transcribe:StartStreamTranscriptionWebSocket` permission for `AWS_REGION`.
The backend signs the connection but never receives or stores microphone audio.
Agent models are selected independently with `MODEL_PROVIDER`. The default is
OpenAI through the Strands Responses API using `OPENAI_MODEL`; its
`OPENAI_API_KEY` must remain backend-only. Bedrock remains available by setting
`MODEL_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, and the applicable AWS credentials.
`REPORT_MAX_RESPONSES` defaults to 30 for the first bounded report workflow;
larger snapshots are rejected explicitly until batching is implemented.

Useful commands:

```powershell
corepack pnpm db:rollback
corepack pnpm db:migrate
corepack pnpm --filter @saywide/backend test
corepack pnpm --filter @saywide/backend build
corepack pnpm --filter @saywide/backend model:smoke
```

`model:smoke` is a backend-only, one-shot Strands invocation. It uses
`MODEL_PROVIDER` and the matching model configuration, prints only safe
provider, model, region (when applicable), timing, stop-reason, and token-count
metadata, and exits non-zero if the model does not return the expected
connectivity token. Build the backend before running it. It does not register an
HTTP route and must not be added permanently to the production startup command.
OpenAI mode requires `OPENAI_API_KEY`; Bedrock mode requires a runtime identity
that can invoke the configured model resource.

Integration tests create, migrate, exercise, and remove a disposable database.
Set `TEST_DATABASE_ADMIN_URL` only when the local Docker default is unsuitable.
The deterministic report fixture contains 24 synthetic responses and is kept
under `backend/test`; no runtime seed endpoint exposes it.

## Current boundary

Account registration/login, guest claiming, and goal-to-survey generation are
not registered yet. Live HTTP mode exposes participant voice transcription and
asynchronous Strands reports. Report requests freeze their snapshot using the
database clock, persist privacy-safe run events, validate all model references,
and calculate support counts in application code.
