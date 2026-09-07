# Saywide

Saywide turns open-ended survey responses into evidence-backed reports. The
repository is a pnpm workspace with a dedicated Next.js frontend, a separate
Fastify backend boundary, and browser-safe shared contracts.

The repository now includes a working Phase 1 slice: browser-bound guest
workspaces, manual surveys, publishing and collection status, and anonymous
text responses backed by PostgreSQL. Agent drafting, reports, accounts, and
voice remain available in the synthetic frontend demo only.

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
  tests for the Phase 1 slice.
- `packages/contracts/` — Zod schemas and inferred API types shared by both
  applications.
- `docs/` — product, data, API, and screen specifications.

See [development-spec.md](development-spec.md) for the complete architecture
and implementation plan.
