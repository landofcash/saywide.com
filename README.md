# Saywide

Saywide turns open-ended survey responses into evidence-backed reports. The
repository is a pnpm workspace with a dedicated Next.js frontend, a separate
Fastify backend boundary, and browser-safe shared contracts.

The current implementation is the frontend product slice. Every documented
organizer and participant route is functional against a local mock API, so the
real backend can replace the mock without changing page components.

## Run locally

Requirements: Node.js 22 or later and Corepack.

```powershell
corepack pnpm install
corepack pnpm dev
```

Open <http://localhost:3000>. The seeded participant survey is available at
<http://localhost:3000/s/team-voices>.

## Verify

```powershell
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

## Workspace

- `frontend/` — Next.js App Router application and mock API adapter.
- `backend/` — reserved Fastify service boundary; implementation follows the
  validated frontend slice.
- `packages/contracts/` — Zod schemas and inferred API types shared by both
  applications.
- `docs/` — product, data, API, and screen specifications.

See [development-spec.md](development-spec.md) for the complete architecture
and implementation plan.
