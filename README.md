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
agent drafting and accounts remain available in the synthetic frontend demo only.

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
