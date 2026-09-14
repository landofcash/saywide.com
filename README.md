<div align="center">

<img src="frontend/public/images/saywide-logo-1.png" alt="Saywide logo" width="80" />

# Saywide

**EVERYONE HAS SOMETHING TO SAY**

Build a survey with AI. Collect answers by voice. Turn every voice into better decisions.

[Visit Saywide](https://saywide.com) · [How it works](#how-it-works) · [Run locally](#local-development)

**Powered by the AWS Strands Agents SDK**

</div>

---

## The problem

**Two hundred messages in the group chat. A yes-or-no poll. Still no decision.**

Communities have plenty to say, but busy chats bury concerns and simple polls miss the reasons behind an answer. Organizers are left piecing it all together.

**Saywide turns those responses into structured, evidence-backed reports.** Ask what matters, explore a question or hypothesis, and see which ideas people support. The goal: faster decisions and stronger, happier communities.

## How it works

1. **Describe what you want to learn.** Click **Get started**, continue as a guest, and create a new survey. Speak your idea; AI drafts the title, description, and questions for you to review.
2. **Publish and listen.** Share the link or QR code. Participants answer anonymously by voice or text, then review and submit their responses.
3. **Ask for a report.** Choose a starting point such as **Overall picture**, or write your own request. Watch the agent work, then explore key findings and supporting quotes.

> **Example:** Ask grade 2 parents about their concerns and suggestions. Collect feedback on homework, reading support, and school communication, then ask the agent to identify shared priorities.

<div align="center">
  <img src="docs/saywide-flow.svg" alt="Saywide flow: create an AI-assisted survey, collect participant responses, and generate a report with source validation and calculated support." width="1130" />
</div>

<p align="center"><a href="docs/saywide-flow.svg">View the full-size diagram</a></p>

## What the agent does

Built with **AWS Strands**, the agent turns anonymous responses into a report shaped by the organizer's request:

- Reads the responses and connects similar ideas into clear themes.
- Surfaces shared priorities and concerns that might otherwise be missed.
- Links findings to source evidence and includes supporting quotes.
- Produces a structured report with key insights and suggested actions.

**Evidence is checked in code:** the backend validates source references and calculates support counts and percentages from a fixed response snapshot. Organizers can follow the agent's progress as the report takes shape.

## Technology

<details>
<summary>Stack and data flow</summary>

| Component | Role |
| --- | --- |
| **Next.js** | Organizer dashboard, survey builder, participant experience, and report views |
| **Fastify** | API, session handling, survey operations, and report orchestration |
| **PostgreSQL** | Surveys, submitted responses, report snapshots, and saved findings |
| **AWS Strands Agents SDK** | Agent workflow and trusted report skills |
| **OpenAI** | Default report model, survey drafting, and wording suggestions |
| **Amazon Transcribe** | Live speech-to-text streamed directly from the browser |
| **Zod contracts** | Shared API schemas and types across frontend and backend |

Microphone audio streams directly to Amazon Transcribe using a short-lived signed URL. The Saywide backend authorizes the connection but does not receive or store the audio. Submitted answer text is stored for survey reporting.

</details>

## Local development

<details>
<summary>Setup, configuration, and checks</summary>

**Requirements:** Node.js 22 or later, Corepack, and Docker.

Run from the repository root:

```powershell
corepack pnpm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
docker compose up -d postgres
corepack pnpm db:migrate
```

In `frontend/.env.local`, set `NEXT_PUBLIC_USE_MOCK_API=false` to connect to the local backend. Then start both applications:

```powershell
corepack pnpm dev
```

| Local service | Address |
| --- | --- |
| Website | [localhost:3000](http://localhost:3000) |
| Organizer entry | [localhost:3000/start](http://localhost:3000/start) |
| AI survey creation | [localhost:3000/create](http://localhost:3000/create) |
| Manual survey builder | [localhost:3000/surveys/new](http://localhost:3000/surveys/new) |
| Backend API | `http://localhost:4000` |
| PostgreSQL | `127.0.0.1:5433` |

Organizer pages require a guest or account session and guide new visitors through the entry page. Participant links open directly.

### Enable AI and voice

Configure provider access in `backend/.env`, using the example file as the configuration reference:

| Setting | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Backend-only key for survey drafting, wording suggestions, and OpenAI reports |
| `MODEL_PROVIDER=openai` | Selects the default report provider |
| `OPENAI_MODEL` | Selects the model used by the OpenAI integration |
| `AWS_REGION` | Region used for voice transcription; use your project's assigned Region |
| `AWS_PROFILE` | Local AWS credential profile; the example uses `saywide.com` |

Voice requires an authenticated AWS profile with `transcribe:StartStreamTranscriptionWebSocket` permission. Confirm the project's assigned Region in **AWS Settings > View all projects > Overview > Additional Info > Region** before configuring it. For hosted runtime credentials, omit `AWS_PROFILE`.

Reports also support Amazon Bedrock through `MODEL_PROVIDER=bedrock` and `BEDROCK_MODEL_ID`. Survey drafting and wording suggestions continue to use the OpenAI configuration.

### Explore the UI demo

Set `NEXT_PUBLIC_USE_MOCK_API=true` in `frontend/.env.local` to use synthetic data. The seeded participant survey is available at [localhost:3000/s/team-voices](http://localhost:3000/s/team-voices).

Demo mode lets you explore the interface without live AI or transcription. Use the manual builder in this mode; voice tools require the live API and provider configuration.

### Verify changes

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Backend integration tests use a disposable PostgreSQL database, so keep the local database service running.

</details>

## Current scope

<details>
<summary>Current limits and deployment notes</summary>

- **Evidence review:** agent skills guide analysis and self-checking. A separate enforced reviewer-and-revision workflow is not implemented.

- **Accounts:** registration, login, logout, and confirmed transfer of guest surveys are supported. Email verification and password recovery are not yet implemented.
- **Guest work:** guest workspaces are bound to the browser session. Creating an account preserves guest surveys; signing into an existing account offers a separate transfer confirmation.
- **Report size:** the default limit is 30 submitted response sessions per snapshot. Larger snapshots are rejected; report batching is not implemented.
- **Production sessions:** keep the frontend and API on the same site, such as `saywide.com` and `api.saywide.com`, for the Secure, HttpOnly, SameSite=Lax session cookies. Replace development secrets before deployment. Multiple backend replicas require a shared authentication failure limiter.

</details>

## Repository structure

```text
saywide.com/
├── frontend/             # Next.js application and HTTP/mock API adapters
├── backend/              # Fastify API, database migrations, and report workflow
│   └── skills/           # Trusted guidance for report agents
├── packages/contracts/   # Shared Zod schemas and API types
└── docs/                 # Flow diagram and technical specifications
```

Technical references: [API endpoints](docs/api-endpoints.md) · [Database structure](docs/database-structure.md) · [Application screens](docs/application-screens.md)

---

<div align="center">

**Helping communities turn every voice into better decisions.**

[Visit Saywide](https://saywide.com) · [Explore the flow](docs/saywide-flow.svg)

</div>
