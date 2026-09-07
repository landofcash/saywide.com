# Saywide backend

This directory implements the anonymous-text Phase 1 API described in
[`docs/api-endpoints.md`](../docs/api-endpoints.md): health, guest workspaces,
manual survey CRUD/status, participant-safe survey reads, response sessions,
answer upserts, submission, and short-lived Amazon Transcribe Streaming
authorization for the direct browser voice spike.

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

Useful commands:

```powershell
corepack pnpm db:rollback
corepack pnpm db:migrate
corepack pnpm --filter @saywide/backend test
```

Integration tests create, migrate, exercise, and remove a disposable database.
Set `TEST_DATABASE_ADMIN_URL` only when the local Docker default is unsuitable.
The deterministic report fixture contains 24 synthetic responses and is kept
under `backend/test`; no runtime seed endpoint exposes it.

## Current boundary

Account registration/login, guest claiming, goal-to-survey generation, and
agent reports are intentionally not registered yet. Live HTTP mode exposes
participant voice transcription; the other future capabilities remain hidden
or return a not-found page.
