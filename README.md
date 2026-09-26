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
with [MSW](https://mswjs.io) (frontend behaviour), one [Playwright](https://playwright.dev)
end-to-end happy path.

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

The travel/weather data itself doesn't need persistence — it's fetched fresh from Open-Meteo
and Wikipedia on every request. PostgreSQL exists specifically because authentication benefits
from real persistence (a `users` table, and later `refresh_tokens` if that enhancement lands),
and because it's the database named in the job description. There's deliberately no `cities`,
`travel_history`, or `favourites` table — see the `users`-only schema note under
[Database / migrations](#database-migrations) for why.

`pg` with small, hand-written SQL repositories is used instead of an ORM. At this project's
size — two tables, at most — an ORM's main value (managing complex relations, generating
queries across many entities) doesn't apply, and hand-written SQL means every query is
something I wrote and can explain line by line rather than something an ORM generated. The
trade-off: no automatic query building or migration-from-model generation; `node-pg-migrate`
handles schema migrations separately (see below), and each repository method is a plain SQL
string with parameterized values.

## Why these external APIs

**Weather: [Open-Meteo](https://open-meteo.com).** Free, no API key, and its `timezone=auto`
parameter resolves the correct IANA time zone directly from coordinates — which is what makes
the city-local "today" used throughout this app possible without any date-math of our own; see
[Timezone / date handling](#timezone-date-handling). The alternative considered was
OpenWeatherMap, which needs a key and doesn't offer that same automatic-timezone behaviour.

City description (Stage 5) and IP geolocation (Stage 6) land with their own implementations.

## Architecture overview

The backend follows a fairly conventional Express layering — `controllers` parse a request and
call a `service`, which holds the actual business logic and talks to a `repository` (database)
or a `client` (external API). `services`/`repositories` arrived in Stage 2 with auth;
`clients` (external-API integrations — currently just Open-Meteo) arrived in Stage 4.

**Clients never leak vendor shapes.** `clients/open-meteo/raw-types.ts` declares exactly the
fields Open-Meteo's response actually has (confirmed against a real response, not written from
documentation alone) — snake_case, a 0/1 `is_day`, five parallel `daily` arrays. Nothing outside
`clients/open-meteo/` ever sees that shape: `mapper.ts` converts it to this app's own
`WeatherReport` type (camelCase, `isDay` as a real boolean, one array of day objects instead of
five parallel arrays), and `client.ts` calls that mapper internally before returning — so even
`weather.service.ts`, one layer up, only ever works with our own normalized type. If a second
weather provider were ever added, only this one directory would need to change.

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

**Composition root.** `server.ts` is the one place that wires concrete implementations
together: a real `pg.Pool` → `UserRepository` → `TokenService` → `AuthService`, then passes
the finished services into `createApp()`. Nothing below that — services, repositories,
controllers — imports or constructs its own dependencies; they receive them as plain
constructor/factory arguments (`createAuthService({ userRepository, tokenService, ... })`).
This is what makes integration tests possible without a real server: a test builds the same
chain itself, but pointed at `TEST_DATABASE_URL`, and hands the result straight to
`createApp()`. There's no DI container — for two or three services, one composition function
is simpler than a container's registration/resolution machinery, and it's easy to read exactly
what depends on what by following the constructor calls.

**Frontend.** `AuthProvider` (`auth/AuthProvider.tsx`) holds the logged-in user in React state
and the access token in a `ref` — deliberately not just state. `api/http.ts`'s fetch wrapper
needs the _current_ token on every call, from a plain function, not the value a particular
render's closure happened to capture; a `ref` gives it that without re-registering anything on
every login. `AuthContext`/`useAuth` live in their own file (`auth/AuthContext.ts`), split out
from the `AuthProvider` component itself, purely so that component file only exports a
component — Vite's Fast Refresh only hot-reloads files that exclusively export components, and
a mixed export would silently downgrade every edit to `AuthProvider.tsx` to a full page reload.

`http.ts` and `AuthProvider` can't import each other directly without a circular module graph
(`AuthProvider` → `auth.api.ts` → `http.ts` → would need `AuthProvider` back to read the
token). Instead, `AuthProvider` calls `configureAuthHandlers({ getAccessToken, onUnauthorized })`
once on mount — a small, explicit registration, not a state-management library brought in to
solve one wiring problem. `getAccessToken` is how `http.ts` attaches the Bearer header;
`onUnauthorized` fires when a request _that had a token attached_ comes back 401, clearing the
session and flagging it as expired. A 401 with _no_ token attached (a wrong-password login
attempt) is deliberately not treated as a session expiry — see [Authentication](#authentication).

## Monorepo structure

```
jambo-travel-planner/            (repo root)
  apps/
    api/                         # Express/TypeScript backend
      src/
        app.ts                   # createApp(deps): middleware + routes, no listen()
        server.ts                # composition root: wires deps, listens, graceful shutdown
        config/env.ts            # Zod-validated env; fails fast at startup
        db/pool.ts               # pg.Pool factory
        errors/app-error.ts      # AppError + subclasses
        middleware/              # validate, error-handler, not-found,
                                  #   require-auth, login-rate-limit
        routes/, controllers/    # thin HTTP wiring (e.g. travel.routes.ts, travel.controller.ts)
        services/                # auth, token, weather — business logic, no HTTP or SQL details
        repositories/            # user.repository.ts — SQL via pg, one file per table
        domain/                  # pure logic: password hashing, seed-user parsing,
                                  #   the city catalogue, WMO weather-code labels
        clients/                 # http.ts (fetchJson + UpstreamError), open-meteo/
                                  #   (client.ts, mapper.ts, raw-types.ts — vendor shape
                                  #   never leaves this directory)
      migrations/                # node-pg-migrate (TypeScript migration files)
      scripts/seed-users.ts      # thin CLI: parses SEED_USERS, calls the repository
      test/                      # integration tests (Supertest + a real test database)
    web/                         # React/TypeScript frontend (Vite)
      src/
        api/                     # http.ts (Bearer + 401 handling), auth.api.ts, travel.api.ts, types.ts
        auth/                    # AuthContext, AuthProvider, LoginPage
        travel/                  # TravelPlannerPage, CitySelect, CurrentWeatherCard,
                                  #   WeekForecast, useCityData (abort-based stale-response guard)
        components/              # AppHeader, Skeleton, ErrorState (shared shell UI)
        lib/                     # useDelayedFlag, weather-icons.ts, iso-date.ts (TZ-safe formatting)
        styles/                  # tokens.css (design tokens), global.css
        test/                    # MSW request-mock handlers + a render-with-providers helper
  e2e/                           # Playwright end-to-end tests (Stage 9)
  .github/workflows/ci.yml       # lint, typecheck, migrate, test on every push
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

**Token storage strategy.** The application uses a short-lived JWT access token stored only in
application memory and sends it in the `Authorization: Bearer` header for protected API
requests. This was chosen to directly satisfy the project requirement that API requests use
Bearer-token authentication while avoiding persistent token storage such as localStorage. (A
longer-lived opaque refresh token in an HttpOnly cookie, described under
[Trade-offs](#trade-offs), is a conditional Stage 8 enhancement — not required for the core to
satisfy the assignment.)

**Login (`POST /api/auth/login`).** `email` + `password` in, an access token + the user out.
The password is checked with `bcrypt.compare()` against the stored hash. Whether the email
doesn't exist or the password is wrong, the response is the same generic 401 with the message
"Invalid email or password" — distinguishing the two would let a client enumerate which emails
have accounts. When the email doesn't exist, `bcrypt.compare()` still runs (against a
hardcoded, never-real dummy hash — `domain/password.ts`) rather than short-circuiting, so a
nonexistent-email attempt takes roughly as long as a wrong-password one; skipping the compare
would make "no such account" answerable purely by response time.

**The access token itself** is a `jsonwebtoken`-signed HS256 JWT with `sub` (user id), `email`,
`iat`/`exp`, and pinned `iss`/`aud` claims. `algorithms: ["HS256"]` is pinned explicitly on
verification — not left to whatever algorithm the token itself claims to use — and
issuer/audience are re-checked at verify time too, not just at signing. Its lifetime defaults
to 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`); without a refresh mechanism, 15 minutes would log a
reviewer out mid-review, so the production deployment may run with a longer TTL if Stage 8
isn't implemented — documented under [Trade-offs](#trade-offs) once that's decided.

**No self-registration.** Accounts are created by an env-driven seed script
(`npm run db:seed`, reads `SEED_USERS`) rather than a sign-up flow — out of scope by design,
see [Known limitations](#known-limitations).

**Frontend, as of Stage 3.** `LoginPage` calls `AuthProvider`'s `login()`, which calls the
backend and, on success, stores the access token in memory (see
[Architecture overview](#architecture-overview) for exactly how) and the user in React state —
never in `localStorage` or a cookie the frontend controls. Every subsequent request through
`api/http.ts` attaches `Authorization: Bearer <token>` automatically. If a request comes back
401 _with_ a token attached, the session is cleared and the user is returned to the login
screen with "Your session expired. Please sign in again." A 401 from the login endpoint itself
(wrong credentials) is shown as a form error instead — it isn't a session expiring, since there
was never a session to begin with. Logging out is purely client-side in the core (there's no
`/api/auth/logout` yet — see [Trade-offs](#trade-offs)): it just clears the in-memory token and
user.

**Reload behaviour, honestly stated:** since the token lives only in memory, refreshing the
page logs the user out — there is no session to restore from. This is the direct, accepted
consequence of not using `localStorage` and not yet having a refresh-token cookie (Stage 8).

## Security considerations

**In place since Stage 1:** Helmet's baseline security headers on every response, a CORS
allowlist restricting which origins may call the API from a browser at all, a small JSON
body-size limit, and a central error handler that never sends a stack trace, an internal error
message, or any other implementation detail to the client.

**Added in Stage 2:**

- Passwords are hashed with bcrypt (cost factor 10) — never stored or logged in plain text,
  never returned in any API response.
- bcrypt only reads a password's first 72 bytes; the login endpoint's Zod schema caps password
  length so a truncation footgun surfaces as a clear validation error instead of a confusing
  "it silently ignored part of what I typed." The seed script enforces the same limit, measured
  in actual UTF-8 bytes rather than character count, at the point where it would actually cause
  silent truncation.
- Login is rate-limited (`express-rate-limit`, 10 attempts / 15 minutes per IP) — the only rate
  limiter in this app. A general API-wide limiter was deliberately left out: the travel
  endpoints are already behind Bearer auth, and picking an arbitrary global threshold for a
  take-home adds configuration without a real problem behind it. If asked: _"I rate-limited the
  security-sensitive authentication endpoint. For a production public API I'd introduce
  per-user or per-IP limits based on real usage patterns and upstream-provider quotas, rather
  than picking arbitrary limits here."_ This limiter's accuracy depends on `req.ip` reflecting
  the real client, which in turn depends on Express's `trust proxy` matching the actual
  deployment — verified in the deployment stage (Stage 3.5/6), not guessed at now.
- CSRF/XSS implications of the token architecture, and the cookie-specific concerns that come
  with Stage 8, are covered once that stage lands.

## IP-based geolocation

_Coming in Stage 6._

## Timezone / date handling

The core mechanism landed in Stage 4, alongside the weather endpoint; Stage 7 adds the actual
forecast-date picker UI on top of it.

**The problem this solves:** if it's 11pm in Calgary, it's already tomorrow in Tokyo. "Today"
only makes sense relative to the city being viewed, not to the server's clock or the browser's
own time zone. Open-Meteo's `timezone=auto` parameter resolves the correct IANA time zone
directly from the requested coordinates, and its `daily.time[0]` is that city's local calendar
date — so `localDate` in the API response, and `allowedForecastDates.min`, come from Open-Meteo
itself, not from any date arithmetic this backend performs. Confirmed for real, not just assumed:
requesting Tokyo and Calgary at the same moment during development returned `localDate: "2026-09-26"`
for Tokyo and `"2026-09-25"` for Calgary — the exact scenario this design exists for, reproduced
live against the real API rather than only covered by a unit-test fixture.

**Dates are kept as plain `"YYYY-MM-DD"` strings end to end** — parsed from Open-Meteo, stored
in `WeatherReport`, and (once Stage 7 adds it) compared directly as strings for range
validation. `new Date("2026-09-25")` parses as UTC midnight; naively formatting that in the
browser's own time zone can silently shift the displayed date by a day for any browser west of
UTC. The frontend's `lib/iso-date.ts` avoids this by explicitly formatting with `timeZone:
"UTC"` wherever an ISO date string needs a human-readable label (e.g. the week forecast's
weekday names) — its test demonstrates the exact bug by comparing against Honolulu (UTC-10),
which really does render one day off without that pin.

## API overview

## API overview

| Method & path                                 | Auth               | Purpose                                                                                          |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `GET /health`                                 | none               | `{ "status": "ok" }` — used by the hosting platform's health check                               |
| `POST /api/auth/login`                        | none, rate-limited | `{email,password}` → `200 {accessToken, expiresIn, user}`; 400 bad body; 401 invalid credentials |
| `GET /api/cities`                             | Bearer             | `200 City[]` — the static catalogue, see [Database / migrations](#database-migrations)           |
| `GET /api/weather?latitude={n}&longitude={n}` | Bearer             | `200 WeatherReport`; 400 invalid/out-of-range coordinates; 502/504 on an Open-Meteo failure      |

Every route except `/health` and `/api/auth/login` requires a valid `Authorization: Bearer`
header. Every error response uses the same envelope:
`{ "error": { "code": "SOME_CODE", "message": "...", "details"?: [...] } }`.

**`WeatherReport`** (see `services/weather.service.ts` for the exact TypeScript types):
`{ timezone, localDate, allowedForecastDates: {min, max}, units, current: {observedAt,
temperature, feelsLike, humidity, windSpeed, isDay, condition: {code, label}}, week:
DailyForecast[7] }`, where each `DailyForecast` is `{ date, condition, temperatureMax,
temperatureMin, precipitationProbabilityMax, sunrise, sunset }`. More endpoints (city
description, IP-detected location) land in Stages 5–6.

## Local setup

```bash
npm install               # installs both apps' dependencies (npm workspaces)

# One-time local database setup (any PostgreSQL 16+ works):
createdb jambo_dev
createdb jambo_test
DATABASE_URL=postgres://localhost/jambo_dev npm run db:migrate -w @jambo/api
TEST_DATABASE_URL=postgres://localhost/jambo_test npm run db:migrate:test -w @jambo/api

# Seed a local user (SEED_USERS format: "email1:password1,email2:password2"):
DATABASE_URL=postgres://localhost/jambo_dev SEED_USERS="demo@example.com:demopassword123" \
  npm run db:seed -w @jambo/api

npm run lint
npm run typecheck
npm test

cd apps/api
npm run dev                # starts the API on http://localhost:3000
```

In a second terminal:

```bash
cd apps/web
npm run dev                # starts the frontend on http://localhost:5173
```

Open `http://localhost:5173` and sign in with whatever account you seeded above. No frontend
`.env` is needed for local dev — the frontend's default API URL (`http://localhost:3000`) and
the backend's default CORS allowlist (`http://localhost:5173`) already match each other out of
the box.

Requires Node.js 24+ (see `.nvmrc`). `npm run dev` and `npm run db:seed` both pick up a local
`.env` file automatically if one exists (`--env-file-if-exists`); it's entirely optional — the
commands above work with env vars passed inline instead, which is what CI does.

## Environment variables

**Backend** — validated at startup (`apps/api/src/config/env.ts`); the process refuses to
start if one is missing or malformed, with a message naming the offending variable.

| Variable                   | Required | Default                      | Purpose                                                                                                           |
| -------------------------- | -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | no       | `development`                | `development` \| `test` \| `production`                                                                           |
| `PORT`                     | no       | `3000`                       | HTTP port the API listens on                                                                                      |
| `CORS_ORIGINS`             | no       | `http://localhost:5173`      | Comma-separated list of origins allowed to call the API from a browser                                            |
| `DATABASE_URL`             | **yes**  | —                            | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/db`                                            |
| `JWT_SECRET`               | **yes**  | —                            | HS256 signing secret for access tokens; at least 32 characters                                                    |
| `ACCESS_TOKEN_TTL_SECONDS` | no       | `900` (15 min)               | How long an access token stays valid, in seconds                                                                  |
| `OPEN_METEO_BASE_URL`      | no       | `https://api.open-meteo.com` | Base URL for the weather client — overridden in integration tests to point at a local stub, never at the real API |

Not validated by `config/env.ts` (read directly by their respective one-off scripts, not by the
running server): `TEST_DATABASE_URL` (integration tests and `db:migrate:test`), `SEED_USERS`
(`db:seed` — format `"email1:password1,email2:password2"`, see
[Authentication](#authentication)).

More backend variables (`TRUST_PROXY_HOPS`, `DEFAULT_CITY_ID`, more provider base URLs) are
added as the stages that need them land.

**Frontend** — read by Vite at build time (`import.meta.env.VITE_*`). There's no startup
validation step the way the backend has one — a static site has no "startup" to fail at — so
this is documented here instead.

| Variable            | Required | Default                 | Purpose                                     |
| ------------------- | -------- | ----------------------- | ------------------------------------------- |
| `VITE_API_BASE_URL` | no       | `http://localhost:3000` | Base URL the frontend sends API requests to |

The default matches the backend's own default `PORT`, so local development needs no frontend
`.env` at all. Production sets this to the deployed API's real URL (a Vercel project setting,
configured during the deployment stage).

## Database / migrations

Local development requires PostgreSQL 16+ (any install — Postgres.app, Homebrew, a system
package, or a Neon development branch all work) reachable via `DATABASE_URL`. Docker is not
required.

Schema migrations use [node-pg-migrate](https://github.com/salsita/node-pg-migrate), written
in TypeScript (`apps/api/migrations/*.ts`), run via `npm run db:migrate -w @jambo/api` (reads
`DATABASE_URL`) or `npm run db:migrate:test -w @jambo/api` (reads `TEST_DATABASE_URL` instead —
same migrations, different target database). `npm run db:migrate:create -w @jambo/api -- <name>`
scaffolds a new one.

**Schema, as of Stage 2:**

```sql
users
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
  email          text NOT NULL UNIQUE CHECK (email = lower(email))
  password_hash  text NOT NULL
  created_at     timestamptz NOT NULL DEFAULT now()
  updated_at     timestamptz NOT NULL DEFAULT now()
```

That's the only table. There's deliberately no `cities` table — the catalogue
(`domain/city-catalogue.ts`) is a small, static, read-only list of ~10 cities, and a typed
constant is version-controlled, type-checked, and needs no query or migration to change; a
table would earn its place with admin editing, per-user favourites, or thousands of cities,
none of which apply here. Same reasoning for the absence of travel-history or favourites tables
(out of scope — see [Known limitations](#known-limitations)). `gen_random_uuid()` needs no
extension on PostgreSQL 13+, and the `CHECK` constraint enforces the email-is-already-lowercase
invariant the application code relies on for case-insensitive lookups, rather than trusting
every write path to remember to normalize it.

## Running tests

```bash
npm test              # unit + integration tests, both workspaces
npm run test:coverage # same, with a coverage report
```

Backend integration tests require `TEST_DATABASE_URL`, pointed at a database with migrations
already applied (`npm run db:migrate:test -w @jambo/api`) — see
[Local setup](#local-setup). Without it, the integration test suite fails immediately with a
message saying so, rather than a confusing connection error. CI provisions a PostgreSQL
service container and runs the migration automatically before tests. The Playwright end-to-end
test (`npm run e2e`, Stage 9) is separate from `npm test`.

## Testing strategy

**Unit tests** live next to the file they test (`src/**/*.test.ts`) and cover logic that can
actually be wrong: env parsing/defaults, the validation middleware, the central error
handler's mapping from a thrown error to an HTTP response, JWT signing/verification (expired
tokens, wrong secret, wrong algorithm, wrong issuer/audience — all deliberately tested, not
just the happy path), the `requireAuth` middleware in isolation (mocked `TokenService`), the
auth service's login logic (mocked repository — including a test that the timing-safety dummy
bcrypt compare actually runs on an unknown email, not just that it _would_ if someone
remembered to call it), and the `SEED_USERS` parser (including the UTF-8-bytes-not-characters
edge case for the 72-byte bcrypt limit).

**Stage 4 adds:** the Open-Meteo mapper, tested against a fixture built from a real captured
response (not written from documentation) — current-weather conversion (`is_day: 0/1` → a real
boolean), all 7 days mapped in order, `localDate`/`allowedForecastDates` derived from
`daily.time`, and two "the vendor lied about its own shape" cases (an empty `daily.time`, a
`daily` array shorter than the others) that surface as a clear thrown error rather than
`undefined` silently flowing into the response; `fetchJson`'s timeout/network-failure/non-2xx
handling, with the global `fetch` stubbed directly (consistent with how the rest of the backend
injects a fake collaborator, rather than reaching for a request-mocking library the way the
frontend does — that style is reserved for where there's a real browser-fetch boundary to
simulate); and the city catalogue's own integrity (unique ids, valid coordinate ranges).

**Integration tests** live under `apps/api/test/` and exercise the whole wired-up app over
real HTTP with Supertest. `POST /api/auth/login` runs against a real PostgreSQL database rather
than a mock, since a mock can't catch a mismatch between a migration's columns and a
repository's SQL the way an actual query does; `/api/cities` and `/api/weather` need no
database at all, so they're tested with a fake `WeatherService` injected via `createApp()`'s
dependencies instead — including the Bearer-protection coverage (missing/invalid/valid token)
that Stage 2 had deferred for lack of a real protected route to test against, and the
structured-502/504 response `middleware/error-handler.ts` produces when the weather service
reports an upstream failure.

Coverage (`npm run test:coverage`) is scoped to directories with real logic (`config`,
`errors`, `middleware`, `services`, `domain`, `clients/*/mapper.ts`) rather than boilerplate
like route wiring — there's no 100% target. Expanded through Stage 9; see the project's testing
matrix for the full requirement-to-test mapping.

**Frontend tests**, as of Stage 3, use React Testing Library and [MSW](https://mswjs.io) to
intercept `fetch` at the network level rather than mocking `fetch` itself or the API-client
functions — a request that doesn't match a configured handler fails the test loudly
(`onUnhandledRequest: "error"`), instead of silently hitting the real network. Tests fall into
three levels: a pure-logic unit test with no rendering at all (`useDelayedFlag`, using fake
timers rather than waiting on real ones); component tests with `useAuth()` mocked directly, so
`LoginPage`'s own rendering logic (form, pending state, error display) is tested in isolation
from `AuthProvider`; and one integration-style test (`App.test.tsx`) that renders real
components through a real `AuthProvider`, types into real inputs, and drives an MSW-mocked
login end to end to confirm the login screen actually gets swapped for the authenticated view —
the level at which "does the wiring between AuthProvider, http.ts, and LoginPage actually work"
gets tested, rather than asserted piecewise across separate unit tests. That same test now
continues one step further, into Stage 4's travel planner, confirming the default city's
weather renders with no further user action needed.

**Stage 4's most important frontend test** is `useCityData`'s stale-response guard: MSW's
`delay()` helper deliberately makes one city's response slow and a second city's fast, switches
between them before the slow one resolves, and asserts the slow response never overwrites the
fast one once it's already displayed — a real race condition, reproduced deliberately rather
than hoped not to occur. `TravelPlannerPage`'s own test goes one level up, switching cities
through the actual rendered `<select>` and confirming the _displayed_ temperature and condition
change to match — not just that the dropdown's value changed, but that the switch actually
re-fetched and re-rendered. `CitySelect`, `CurrentWeatherCard`, and `WeekForecast` each get
focused tests for their own rendering logic (temperature rounding, the "Today" label always
applying to the first day regardless of what weekday it falls on, `onChange` firing with the
right city id), and `iso-date.ts`'s weekday formatter has a test that deliberately compares
against Honolulu (UTC-10) to prove the date-shift bug it avoids is real, not hypothetical.

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
