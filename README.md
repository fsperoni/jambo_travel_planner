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

**Data:** PostgreSQL (`users`, plus `refresh_tokens` if the refresh-token enhancement lands —
see [Why PostgreSQL](#why-postgresql)),
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
role of a singleton auth service, and the fetch wrapper that attaches the Bearer token and
reacts to a 401 is the same idea as an Angular `HttpInterceptor`.

## Why Express

The job description names Node.js/TypeScript with Express (or a similar framework) as
preferred, so Express is the direct match rather than a workaround. NestJS — the closer
Node.js analogue to Angular, with its own dependency injection, decorators, and module system
— was considered and set aside for the same reason as the frontend framework choice: it adds
concepts (DI containers, decorator-based routing, guards, pipes) that aren't necessary at this
project's size and that I'd rather not have to explain in a walkthrough alongside everything
else. Express's request → middleware → handler model is simple enough that the whole request
lifecycle (see [Architecture overview](#architecture-overview)) fits in a few files I wrote
and understand end to end.

## Why PostgreSQL

_Coming in Stage 2, once the first table exists._

## Why these external APIs

_Coming in Stages 4–6, alongside the weather/description/geolocation implementations._

## Architecture overview

The backend follows a fairly conventional Express layering — `controllers` parse a request and
call a `service`, which holds the actual business logic and talks to a `repository` (database)
or a `client` (external API). None of the layers above `middleware`/`errors`/`config` exist yet
as of Stage 1; this section grows with them.

**`createApp()` vs `server.ts`.** `app.ts` exports a `createApp(deps)` function that builds and
returns the configured Express app — it never calls `.listen()`. `server.ts` is the only file
that does: it loads and validates env, builds the app, starts the HTTP listener, and wires
graceful shutdown. The split exists so integration tests can import `createApp`, build the app
directly, and drive it with Supertest — no port to bind, no process to keep alive, no leftover
server between test files.

**Errors.** Anything in a controller, service, or middleware that needs to fail with a specific
HTTP status throws an `AppError` (`status`, a stable machine-readable `code`, a client-safe
`message`, optional `details`). A single `errorHandler` middleware, mounted last, is the only
place that turns any thrown error into a JSON response — including a `ZodError` from failed
validation (mapped to 400) and anything unrecognized (mapped to a generic 500, logged
server-side, no stack trace or internal detail ever sent to the client). Centralizing this in
one place means no controller has to remember to catch and format its own errors.

**Request validation.** Each route that needs it declares Zod schemas via a `validate({ body,
query, params })` middleware. Express 5 made `req.query` a read-only property (no setter) — an
intentional framework change, not a bug I introduced — so instead of mutating `req.body` and
`req.params` in place while doing something different for `req.query`, validated input for all
three always lands on one `req.valid` property. Controllers read from there; it's a single,
predictable place regardless of which part of the request a value came from.

## Monorepo structure

```
jambo-travel-planner/            (repo root)
  apps/
    api/                         # Express/TypeScript backend
      src/
        app.ts                   # createApp(deps): middleware + routes, no listen()
        server.ts                # bootstrap: load env, listen, graceful shutdown
        config/env.ts            # Zod-validated env; fails fast at startup
        errors/app-error.ts      # AppError + subclasses
        middleware/              # validate, error-handler, not-found
      test/                      # integration tests (Supertest)
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

_Coming in Stage 2: a JWT access token in memory, sent as `Authorization: Bearer`, is enough on
its own to satisfy the assignment. Stage 8 (refresh tokens, an HttpOnly cookie) is a
conditional enhancement built only once Stages 0–7 are a complete, polished submission on
their own — see [Trade-offs](#trade-offs) once that section lands._

## Security considerations

In place as of Stage 1: Helmet's baseline security headers on every response, a CORS
allowlist restricting which origins may call the API from a browser at all, a small JSON
body-size limit, and a central error handler that never sends a stack trace, an internal error
message, or any other implementation detail to the client — only a stable `code` and a
client-safe `message`. The rest (JWT/auth-specific concerns, CSRF/XSS implications of the
token architecture, rate limiting) is expanded starting Stage 2 and through Stage 10.

## IP-based geolocation

_Coming in Stage 6._

## Timezone / date handling

_Coming in Stage 7._

## API overview

| Method & path | Auth | Purpose                                                            |
| ------------- | ---- | ------------------------------------------------------------------ |
| `GET /health` | none | `{ "status": "ok" }` — used by the hosting platform's health check |

More endpoints land starting Stage 2. Every error response uses the same envelope:
`{ "error": { "code": "SOME_CODE", "message": "...", "details"?: [...] } }`.

## Local setup

```bash
npm install               # installs both apps' dependencies (npm workspaces)
npm run lint
npm run typecheck
npm test

cd apps/api
npm run dev                # starts the API on http://localhost:3000
```

Requires Node.js 24+ (see `.nvmrc`). No database or `.env` file is required yet — the API only
needs env vars from Stage 2 onward.

## Environment variables

All backend env vars are validated at startup (`apps/api/src/config/env.ts`); the process
refuses to start if one is missing or malformed, with a message naming the offending variable.

| Variable       | Required | Default                 | Purpose                                                                                                     |
| -------------- | -------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | no       | `development`           | `development` \| `test` \| `production`                                                                     |
| `PORT`         | no       | `3000`                  | HTTP port the API listens on                                                                                |
| `CORS_ORIGINS` | no       | `http://localhost:5173` | Comma-separated list of origins allowed to call the API from a browser (the Vite dev server's default port) |

More variables (`DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `TRUST_PROXY_HOPS`,
`DEFAULT_CITY_ID`, provider base URLs) are added as the stages that need them land — see the
table grow here rather than all at once.

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

As of Stage 1: unit tests live next to the file they test (`src/**/*.test.ts`) and cover
logic that can actually be wrong — env parsing/defaults, the validation middleware, and the
central error handler's mapping from a thrown error to an HTTP response (including that a
generic message reaches the client while the real error is only logged server-side).
Integration tests live under `apps/api/test/` and exercise the whole wired-up app over real
HTTP with Supertest, rather than one function at a time — currently just `/health` and the
404 fallback. Coverage (`npm run test:coverage`) is scoped to directories with real logic
(`config`, `errors`, `middleware`, and `services`/`domain`/`clients` once they exist), not
boilerplate like route wiring — there's no 100% target. Expanded through Stage 9; see the
project's testing matrix for the full requirement-to-test mapping.

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
