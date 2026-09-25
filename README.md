# Jambo Travel Planner

A single-page travel planner built for Jambo's Intermediate Software Developer take-home
project: pick a city, see a short description, its current weather, and its week-ahead
forecast — including a forecast for a specific day up to five days out. The app defaults to
the city closest to your IP address.

> **Status: work in progress.** This README is filled in incrementally as each implementation
> stage lands; sections not yet written are marked `_Coming in Stage N_` below rather than left
> silently empty.

## Table of contents

1. [Project overview](#jambo-travel-planner)
2. [Live demo](#live-demo)
3. [Tech stack](#tech-stack)
4. [Why React instead of Angular](#why-react-instead-of-angular)
5. [Why Express instead of Angular's Node ecosystem (e.g. NestJS)](#why-express)
6. [Why PostgreSQL](#why-postgresql)
7. [Why these external APIs](#why-these-external-apis)
8. [Architecture overview](#architecture-overview)
9. [Monorepo structure](#monorepo-structure)
10. [Authentication / JWT architecture](#authentication)
11. [Security considerations](#security-considerations)
12. [IP-based geolocation](#ip-based-geolocation)
13. [Timezone / date handling](#timezone-date-handling)
14. [API overview](#api-overview)
15. [Local setup](#local-setup)
16. [Environment variables](#environment-variables)
17. [Database / migrations](#database-migrations)
18. [Running tests](#running-tests)
19. [Testing strategy & coverage](#testing-strategy)
20. [Deployment architecture](#deployment-architecture)
21. [AI usage](#ai-usage)
22. [Known limitations](#known-limitations)
23. [Trade-offs](#trade-offs)
24. [What I'd improve with more time](#what-id-improve-with-more-time)

## Live demo

_Coming in Stage 11 (final deploy)._ Demo credentials are shared privately with the
submission, not committed to this public repository.

## Tech stack

**Frontend:** React, TypeScript, Vite, plain CSS + CSS Modules, [Lucide](https://lucide.dev)
icons.

**Backend:** Node.js, TypeScript, Express 5, [Zod](https://zod.dev) for validation, [`pg`](https://node-postgres.com)
with hand-written SQL repositories (no ORM), [node-pg-migrate](https://github.com/salsita/node-pg-migrate)
for schema migrations, bcrypt for password hashing, `jsonwebtoken` for access tokens, Helmet,
a CORS allowlist, and `express-rate-limit`.

**Data:** PostgreSQL (`users` and `refresh_tokens` only — see [Why PostgreSQL](#why-postgresql)),
[Open-Meteo](https://open-meteo.com) for weather, the [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)
for city descriptions, [ipapi.co](https://ipapi.co) for IP geolocation.

**Testing:** [Vitest](https://vitest.dev) (backend unit tests), [Supertest](https://github.com/ladjs/supertest)
against a real PostgreSQL instance (integration tests), [React Testing Library](https://testing-library.com/react)
(frontend behaviour), one [Playwright](https://playwright.dev) end-to-end happy path.

**Delivery:** an npm-workspaces monorepo, GitHub Actions for CI (lint, typecheck, test on
every push), Vercel (frontend), Render (backend), Neon (PostgreSQL).

## Why React instead of Angular

The assignment states Angular with Node.js/TypeScript is strongly preferred for this role,
but explicitly allows alternatives (React, Vue) if justified. My submitted resume shows
professional, production React/TypeScript experience — no Angular experience — and the
technical interview covered React specifically. Because I'm expected to explain and defend
every implementation choice in the follow-up walkthrough, I chose to build in the framework I
can reason about at a production level rather than submit Angular code I'd be unable to defend
with the same depth. The backend still aligns with Jambo's preferred stack: Node.js,
TypeScript, and Express.

Angular was seriously considered, not dismissed by default. If it's useful in the
walkthrough, the concepts map fairly directly: this project's `api/` client modules are the
rough equivalent of Angular injectable services, the `AuthProvider` React context plays the
role of a singleton auth service, and the fetch wrapper's automatic 401-refresh-retry logic is
the same idea as an Angular `HttpInterceptor`.

## Why Express

_(Also covers why not NestJS.)_ Coming alongside [Architecture overview](#architecture-overview)
in Stage 1.

## Why PostgreSQL

_Coming in Stage 2._

## Why these external APIs

_Coming in Stages 4–6, alongside the weather/description/geolocation implementations._

## Architecture overview

_Coming in Stage 1._

## Monorepo structure

```
jambo-travel-planner/            (repo root)
  apps/
    api/                         # Express/TypeScript backend
    web/                         # React/TypeScript frontend (Vite)
  e2e/                           # Playwright end-to-end tests (Stage 9)
  .github/workflows/ci.yml       # lint, typecheck, test on every push
  package.json                   # npm workspaces root
```

Frontend and backend live in one repository but are independently deployable — they have
separate `package.json` files, separate build outputs, and no runtime dependency on each
other beyond the HTTP API contract. There is deliberately no `packages/shared` workspace: the
handful of DTO types the two apps have in common are small enough (roughly eight interfaces)
that duplicating them in `apps/web/src/api/types.ts` is simpler than the build plumbing a
shared, separately-compiled package would need, and the integration/E2E tests catch any drift
between the two copies. This is a trade-off, not a rule — a larger shared contract would
justify the extra package.

## Authentication

_Coming in Stage 2 (access tokens) and Stage 8 (refresh tokens)._

## Security considerations

_Coming in Stage 2, expanded through Stage 10._

## IP-based geolocation

_Coming in Stage 6._

## Timezone / date handling

_Coming in Stage 7._

## API overview

_Coming in Stage 1, filled in as endpoints land._

## Local setup

_Coming in Stage 1 once the API has something to run. In the meantime:_

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Requires Node.js 24+ (see `.nvmrc`).

## Environment variables

_Coming in Stage 1._

## Database / migrations

Local development requires PostgreSQL 16+ (any install — Postgres.app, Homebrew, a system
package, or a Neon development branch all work) reachable via `DATABASE_URL`. Docker is not
required. Details land in Stage 2 once the first migration exists.

## Running tests

```bash
npm test              # unit + integration tests, both workspaces
npm run test:coverage # same, with a coverage report
```

Backend integration tests additionally require `TEST_DATABASE_URL` (Stage 2 onward). The
Playwright end-to-end test (`npm run e2e`, Stage 9) is separate from `npm test`.

## Testing strategy

_Coming in Stage 2, expanded through Stage 9. See the project's testing matrix for the full
requirement-to-test mapping._

## Deployment architecture

_Coming in Stage 3.5 (deployment spike) and finalized in Stage 11._

## AI usage

Development uses Claude Code (Anthropic) and, at times, ChatGPT as coding assistants,
disclosed here per the assignment's AI use policy. A running log of what was AI-assisted and
how is kept in [`AI_USAGE.md`](./AI_USAGE.md) throughout development; this section will
summarize it once the project is feature-complete. I remain responsible for reviewing,
understanding, and being able to defend every line of submitted code.

## Known limitations

_Coming in Stage 11, alongside the final deploy._

## Trade-offs

_Coming in Stage 11 — see `AI_USAGE.md` and the project plan in the meantime for the
trade-offs identified during design._

## What I'd improve with more time

_Coming in Stage 11._
