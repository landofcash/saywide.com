# Saywide backend

## Organizer voice input and text polishing

The survey builder supports dictating the title, participant introduction, and each question separately.
`POST /api/organizer/transcription-sessions` issues an Amazon Transcribe streaming URL
using the existing AWS configuration. It requires an organizer session and an allowed browser
origin, and is limited to 20 requests per hour per IP. Audio streams directly from the
browser to Transcribe; the application does not store it.

`POST /api/organizer/polish-text` accepts `{ field: "title" | "introduction" | "question", text: string }`
and returns `{ text: string }`. It uses `OPENAI_API_KEY` and `OPENAI_MODEL` from the backend
environment, independently of the report model provider. This endpoint also requires a
organizer session and allowed origin and is limited to 20 requests per hour per IP. Model calls
have a 30-second timeout, no retries, and response storage disabled. It only suggests wording;
it does not save a survey, generate questions, or change dates. The browser shows the suggestion
for review and supports keeping or restoring the original text. Manual editing remains available
when either provider is unavailable. Demo mode reports that these tools require the live API.

This directory implements the anonymous-text and report APIs described in
[`docs/api-endpoints.md`](../docs/api-endpoints.md): health, guest workspaces,
manual survey CRUD/status, participant-safe survey reads, response sessions,
answer upserts, submission, short-lived Amazon Transcribe Streaming
authorization, account access, AI survey drafting, and the evidence-backed report workflow.

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
`TRUST_PROXY` defaults to `false`, so forwarded headers from direct clients are
ignored. Set `TRUST_PROXY=true` on the Railway backend service: Railway is the
trusted public ingress and this makes IP-based limits use the original client
address. Do not enable it for a directly exposed server unless its proxy chain
is explicitly trusted.
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

### Report skills

Trusted skill content lives in `skills/<id>/SKILL.md` with supporting examples.
`src/agents/skill-catalogue.ts` is the allowlist and version registry. Only
feedback-synthesis and evidence-review are currently available to report agents.
The Strands AgentSkills plugin exposes their descriptions first; full guidance
and the small supporting files are delivered on activation. No shell, arbitrary
file reader, remote URL loader, or user-uploaded skills are exposed.

Before model invocation, an immutable `skills_available` agent event records
the available IDs, versions, SHA-256 content hashes, and deployment revision.
Hashes include sorted resource paths and text with normalized Git line endings.
The revision uses `RAILWAY_GIT_COMMIT_SHA`, or optional `DEPLOYMENT_REVISION`
locally; it is null when unavailable, never guessed. Confirmed plugin activations
produce `skill_activated` events referencing the same versions/hashes. The public
organizer activity projection exposes only safe labels, not skill contents.

To update a skill, edit its files, increment its catalogue version, run tests,
review the Git diff, and deploy. Existing events are not rewritten. Preserve Git
history so historical hashes can be resolved to the original source. The backend
build copies skills into `dist/skills`; deploy the entire dist directory.

Activation records mean "guidance loaded", not "review completed". The report
agent is prompted to self-check, but a separate enforced review/revision workflow
is not implemented here. Backend reference validation and counting remain mandatory.
Account registration, login, logout, and explicit guest-workspace transfer are
registered alongside survey drafting at `POST /api/organizer/draft-survey`.
Live HTTP mode exposes participant voice transcription and
asynchronous Strands reports. Report requests freeze their snapshot using the
database clock, persist privacy-safe run events, validate all model references,
and calculate support counts in application code.
