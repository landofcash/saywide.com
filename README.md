# Saywide

Saywide turns open-ended survey responses into evidence-backed reports. The
repository is a pnpm workspace with a dedicated Next.js frontend, a separate
Fastify backend boundary, and browser-safe shared contracts.

The repository now includes working anonymous-response and report slices: browser-bound guest
workspaces, manual surveys, publishing and collection status, and anonymous
text responses backed by PostgreSQL. Live HTTP mode also includes the minimal
participant voice path: the backend issues a short-lived signed URL and the
browser streams microphone PCM directly to Amazon Transcribe. The backend runs
the evidence-backed report workflow through Strands with OpenAI by default;
the live `/create` page also turns recorded descriptions into editable AI survey
drafts. Email/password accounts support registration, login, logout, and explicit
transfer of guest surveys into an existing account.

Dashboard and Get started open `/start` for new visitors and returning guests.
Continue as guest creates or restores the browser workspace; signed-in organizers
go directly to their dashboard. Signup preserves existing guest surveys. Login
offers a separate confirmation before moving guest work into an existing account.
Email verification and forgotten-password recovery are not implemented.

On `/create`, tap the microphone to record and tap stop to generate. Transcripts
stay hidden and in memory; the backend returns validated title, introduction,
and questions through `POST /api/organizer/draft-survey`. Nothing is persisted
until Save draft or Publish in the editor. Recording requires the existing
Transcribe configuration; generation uses the backend `OPENAI_API_KEY` and
`OPENAI_MODEL`. Demo mode offers manual creation instead of simulated recording.

## Run locally

Requirements: Node.js 22 or later, Corepack, and Docker.

```powershell
corepack pnpm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
docker compose up -d postgres
corepack pnpm db:migrate
corepack pnpm dev
```

Set `NEXT_PUBLIC_USE_MOCK_API=false` in `frontend/.env.local` to use the live
Fastify API. Open <http://localhost:3000>; the API listens on
<http://localhost:4000> and its PostgreSQL container binds to local port `5433`.
The root route is the marketing homepage. Use <http://localhost:3000/create>
for AI-assisted survey creation, or <http://localhost:3000/surveys/new> for the
manual survey builder.
Organizer pages require a guest or account session. Without one, they open the
entry page and return to the requested page after a choice. Participant links
remain anonymous and open directly.
For voice testing, log in with the AWS CLI profile named by `AWS_PROFILE` in
`backend/.env` (the example uses `saywide.com`). The identity needs only
`transcribe:StartStreamTranscriptionWebSocket` in the configured `AWS_REGION`.
Do not set `AWS_PROFILE` in Railway; provide AWS runtime credentials there.
Set the backend-only `OPENAI_API_KEY`, keep `MODEL_PROVIDER=openai`, and set
`OPENAI_MODEL=gpt-5.6-luna` to run live reports. The first bounded workflow
accepts up to 30 submitted response sessions per frozen snapshot.

Keep `NEXT_PUBLIC_USE_MOCK_API=true` for the complete synthetic UI demo. Its
seeded participant survey is available at
<http://localhost:3000/s/team-voices>.

Account cookies default to a 30-day absolute lifetime (`ACCOUNT_SESSION_DAYS` in
the backend environment). Guest cookies retain their renewable 365-day default.
Passwords use Argon2id and require 8–128 characters. Registration and login are
rate-limited; email failure counters are bounded and process-local, so deployment
with multiple backend replicas requires a shared limiter. The existing database
schema already contains the account tables; this feature adds no migration.
Deploy backend account support before the frontend that exposes it. Keep frontend
and API on the same site in production (for example `saywide.com` and
`api.saywide.com`) for the host-only, Secure, HttpOnly, SameSite=Lax cookies.

## Verify

```powershell
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

## Workspace

- `frontend/` — Next.js App Router application with HTTP and mock API adapters.
- `backend/` — Fastify API, PostgreSQL repository, migrations, and integration
  tests for the anonymous response and report slices.
- `packages/contracts/` — Zod schemas and inferred API types shared by both
  applications.
- `docs/` — product, data, API, and screen specifications.

See [development-spec.md](development-spec.md) for the complete architecture
and implementation plan.
