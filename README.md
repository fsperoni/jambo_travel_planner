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
12. [Accessibility](#accessibility)
13. [IP-based geolocation](#ip-based-geolocation)
14. [Timezone / date handling](#timezone-date-handling)
15. [API overview](#api-overview)
16. [Local setup](#local-setup)
17. [Environment variables](#environment-variables)
18. [Database / migrations](#database-migrations)
19. [Running tests](#running-tests)
20. [Testing strategy & coverage](#testing-strategy)
21. [Deployment architecture](#deployment-architecture)
22. [AI usage](#ai-usage)
23. [Known limitations](#known-limitations)
24. [Trade-offs](#trade-offs)
25. [What I'd improve with more time](#what-id-improve-with-more-time)

## Live demo

- **Frontend:** [jambo-travel-planner-web.vercel.app](https://jambo-travel-planner-web.vercel.app)
- **Backend API:** [jambo-travel-planner.onrender.com](https://jambo-travel-planner.onrender.com) (not meant to be opened
  directly — a browser hitting `/` there gets a 404 via the app's own JSON error envelope,
  which is correct: every real route needs a Bearer token except `/health` and
  `/api/auth/login`)

Demo credentials are shared privately with the submission, not committed to this public
repository.

Both are on the platforms' default free-tier domains — no custom domain is used, which is
fine here since the core (Stages 0–7) authenticates with a Bearer header rather than a cookie,
so it isn't subject to third-party-cookie restrictions across the two different domains. See
[Authentication](#authentication) and [Trade-offs](#trade-offs) for why that would matter more
if the (currently out of scope) refresh-token cookie enhancement were added later.

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
Open-Meteo's free tier is licensed CC BY 4.0, which requires attribution — the app shows
"Weather data by Open-Meteo.com" beneath the forecast, linked back to the provider.

**City description: the [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/)**
(`page/summary/{title}`). Free, no API key, and its `extract` field is already
plain-paragraph text — no HTML to sanitize or strip client-side, which matters since that text
gets rendered directly (see [Security considerations](#security-considerations)). The
catalogue stores each city's exact Wikipedia page title (`domain/city-catalogue.ts`) rather
than searching by city name at request time, so there's no ambiguous-title search step to get
wrong. Wikimedia's [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy)
requires a descriptive `User-Agent` identifying the calling application and how to reach its
operator — confirmed for real, not just assumed from the docs: a request with no `User-Agent`
gets an actual 403 from the live API. `WIKIPEDIA_USER_AGENT` (see
[Environment variables](#environment-variables)) defaults to a placeholder with no personal
information in it, intended for local development only. Wikipedia's text is CC BY-SA licensed,
which requires attribution back to the source — the app shows a "Read more on Wikipedia" link
using the response's own canonical `content_urls.desktop.page` URL.

**IP geolocation: [ipapi.co](https://ipapi.co).** HTTPS with no API key required (a real
requirement here, unlike weather or description: the client's IP is sent to this provider, and
that shouldn't happen over plain HTTP). The alternative considered, per the project plan, was
[ip-api.com](https://ip-api.com) — its free tier is HTTP-only, which was disqualifying on its
own. ipapi.co's own validation already rejects reserved/private/invalid addresses with a
documented error shape, so this app doesn't need its own IP-range classification logic — see
[IP-based geolocation](#ip-based-geolocation). Its free tier's request quota turned out to be a
real, not just theoretical, constraint while building this: it was already exhausted (a live 429) from two independent networks during development, which is exactly the "provider
unavailable" case the default-city fallback below exists for.

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
weather provider were ever added, only this one directory would need to change. `clients/wikipedia/`
(Stage 5) and `clients/ip-geolocation/` (Stage 6) follow the identical pattern for their own
upstreams.

**A provider's own "couldn't do this" response is data, not an exception.** ipapi.co has an
unusual quirk, confirmed against its own documentation and a live 429: a genuine outage/rate
limit is a normal HTTP error status, but "this IP is reserved" or "this IP is invalid" both come
back as HTTP 200 with an `{error: true, reason: "..."}` body. `clients/ip-geolocation/mapper.ts`
has to read the parsed body to catch those, not just rely on `fetchJson`'s HTTP-status-based
error handling — the same "collapse every non-error 'nothing to show' outcome to one `null`"
shape as the Wikipedia mapper's disambiguation/404 handling, so `location.service.ts` doesn't
need to know or care which specific reason a provider gave, only that it has nothing usable.

**`fetchJson`'s "not found" handling is opt-in, via a type-level flag.** `clients/http.ts`
exposes a `notFoundReturnsNull` option, typed with two overloads so its return type tracks the
flag: passing `notFoundReturnsNull: true` returns `Promise<T | null>`, and leaving it off (the
default) returns `Promise<T>` — a caller can never receive a `null` it didn't opt into handling.
The Wikipedia client sets it (a missing page is a normal, expected `200 {description: null}`,
not an error — see the [API overview](#api-overview)), while the Open-Meteo client leaves it
unset, since a 404 from Open-Meteo would mean something is actually broken, not a normal "no
article for this city" outcome.

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
        services/                # auth, token, weather, description, location —
                                  #   business logic, no HTTP or SQL details
        repositories/            # user.repository.ts — SQL via pg, one file per table
        domain/                  # pure logic: password hashing, seed-user parsing,
                                  #   the city catalogue, WMO weather-code labels,
                                  #   truncate-text.ts (word-boundary description truncation),
                                  #   client-ip.ts (normalize + loopback), normalize-city-name.ts
        clients/                 # http.ts (fetchJson + UpstreamError), open-meteo/,
                                  #   wikipedia/, and ip-geolocation/ (client.ts, mapper.ts,
                                  #   raw-types.ts each — vendor shape never leaves its own
                                  #   directory)
      migrations/                # node-pg-migrate (TypeScript migration files)
      scripts/seed-users.ts      # thin CLI: parses SEED_USERS, calls the repository
      test/                      # integration tests (Supertest + a real test database)
    web/                         # React/TypeScript frontend (Vite)
      src/
        api/                     # http.ts (Bearer + 401 handling), auth.api.ts, travel.api.ts, types.ts
        auth/                    # AuthContext, AuthProvider, LoginPage
        travel/                  # TravelPlannerPage, CitySelect, CurrentWeatherCard,
                                  #   WeekForecast, CityDescriptionCard, ForecastDatePicker,
                                  #   SelectedDayCard, useCityData (also takes an optional date;
                                  #   see Timezone / date handling) and useCityDescription (each
                                  #   with its own abort-based stale-response guard, fetched
                                  #   independently; location detection is fetched the same way,
                                  #   inline in TravelPlannerPage rather than its own hook, since
                                  #   it's a one-time initial-selection concern, not a per-city
                                  #   refetch)
        components/              # AppHeader, Skeleton, ErrorState (shared shell UI)
        lib/                     # useDelayedFlag, weather-icons.ts, iso-date.ts (formatWeekday/
                                  #   formatFullDate pin UTC; formatLocalTime deliberately
                                  #   doesn't — see Timezone / date handling for why both are
                                  #   correct for what each formats)
        styles/                  # tokens.css (design tokens), global.css
        test/                    # MSW request-mock handlers + a render-with-providers helper
  e2e/                           # Playwright end-to-end tests (Stage 9)
    fixtures.ts                  # shared test data — a value is defined once here and
                                  #   referenced by the stub servers, global-setup, and the
                                  #   spec's assertions, rather than duplicated across them
    stub-servers.ts              # fake Open-Meteo/Wikipedia HTTP servers — real upstreams
                                  #   are never hit in this suite (see Testing strategy)
    global-setup.ts              # migrates + seeds the test database once, starts the
                                  #   stub servers, returns their teardown
    playwright.config.ts         # starts the real backend + frontend dev servers, pointed
                                  #   at the stubs and the test database
    tests/happy-path.spec.ts     # login → default city → switch city → pick a forecast date
  .github/workflows/ci.yml       # lint, typecheck, migrate, test, e2e on every push
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
  deployment — the exact same setting Stage 6's IP geolocation depends on too, see
  [IP-based geolocation](#ip-based-geolocation); re-verified in the real deployment stage
  (3.5/11), not just locally.
- CSRF/XSS implications of the token architecture, and the cookie-specific concerns that come
  with Stage 8, are covered once that stage lands.

**Added in Stage 5:**

- Wikipedia's `extract` field is plain paragraph text (confirmed against real responses, not
  assumed), so it's rendered as-is with no `dangerouslySetInnerHTML` and no HTML
  sanitization step — there's no HTML in it to sanitize. If a future description source ever
  returned HTML, this would need revisiting.
- The "Read more on Wikipedia" link opens with `target="_blank"` and, deliberately,
  `rel="noopener noreferrer"` — without it, the opened Wikipedia tab would get an unguarded
  `window.opener` handle back to this app's own window (a real, if minor, security gap for any
  `target="_blank"` link, not specific to Wikipedia).

**Added in Stage 6:**

- A visitor's IP address is personal data under most privacy frameworks (e.g. GDPR) even though
  it's used only transiently, in memory, to ask ipapi.co for a city — it's never written to the
  database, never persisted anywhere, and the one place a lookup failure is logged
  (`location.service.ts`'s `console.warn`) deliberately logs the failure reason, not the IP that
  caused it.
- `TRUST_PROXY_HOPS` set to anything other than the deployment's real hop count is a genuine
  spoofing vector, not just a correctness bug: `true` (trust everything) would let any client
  claim to be any IP simply by sending its own `X-Forwarded-For` header, which would flow
  straight into both this feature and the login rate limiter above. Using an explicit hop count
  instead, verified empirically rather than assumed, is what keeps that header meaningful — see
  [IP-based geolocation](#ip-based-geolocation).

## Accessibility

Accessibility work started well before Stage 10 — `role="status"`/`role="alert"` on every
loading/error state, labelled form controls, `srOnly` text alongside decorative icons — but
Stage 10 is where the app got a dedicated pass rather than accessibility landing only as a
byproduct of building each feature.

**Two real, measured contrast failures, not eyeballed.** Dark mode's `--color-primary` (used
for link/icon text sitting directly on `--color-surface`) and `--color-notice` (the
session-expired/slow-request banner) both computed to well under WCAG AA's 4.5:1 text-contrast
minimum — 2.83:1 and 2.63:1 respectively, checked with the actual relative-luminance formula,
not guessed at from how the colors looked. The fix needed a second token, not just a different
dark-mode value: `--color-primary` is _also_ a button background (white text on it already
passes AA in both themes at its current value), and lightening it for readability against a dark
card would have made that same value fail as a button background instead — the two roles have
opposite requirements from the same starting color. `--color-primary-text` now covers the
text/icon/focus-outline role, adaptive per theme; `--color-primary` stays fixed for buttons. Full
before/after numbers are in `AI_USAGE.md`'s Stage 10 entry.

**The authenticated view had no `<h1>` at all before this.** `LoginPage` has one, but
`AppHeader`'s title was a plain `<span>` — meaning a screen-reader user navigating by heading
level had nothing to land on once past login. Now a real `<h1>`, with an explicit CSS reset
(`margin: 0; font-size: 1rem;`) to keep its previous visual size, since there was no
project-wide heading reset to fall back on.

**Focus order:** the login → authenticated-view transition previously left focus on nothing in
particular, since the "Sign in" button holding it gets unmounted the moment `App.tsx` swaps
views. `AppHeader` now moves focus to its own (`tabIndex={-1}`, programmatically focusable
without joining the normal Tab order) `<h1>` on mount — standard SPA view-transition guidance,
verified with a real `toHaveFocus()` assertion, and confirmed to actually catch a regression by
temporarily removing the `.focus()` call and watching the test fail before reverting.

## IP-based geolocation

`GET /api/location` (Bearer-protected, like every other travel endpoint) returns
`{ city, source: "ip" | "default", reason?: "local-development" | "lookup-failed" }`, and the
frontend uses it to pick the initially-selected city. Every failure mode below collapses to the
same outcome — the default city — because a wrong or missing detected city is a degraded
experience, not a broken one; the app must still work when detection doesn't.

**Where the client IP comes from.** Express's `req.ip` depends entirely on
`TRUST_PROXY_HOPS` / `app.set("trust proxy", ...)` (see
[Environment variables](#environment-variables)) being set correctly for the actual deployment
topology — get it wrong and either a spoofed `X-Forwarded-For` header is trusted (a client could
claim to be any IP it likes) or the app always sees its own reverse proxy's IP instead of the
real visitor's. This app's numeric `trust proxy` behavior was verified empirically before being
relied on, not assumed from memory: with exactly one trusted hop (the setting used in
production, behind Render's own load balancer), Express takes the _last_ entry of
`X-Forwarded-For` as `req.ip` — the address that hop actually observed — which correctly ignores
anything a client prepends to that header on their own request. Confirmed with a real Supertest
request in `test/travel.test.ts`, not just reasoned about.

**Local development is short-circuited before any provider call.** `domain/client-ip.ts`'s
`normalizeIp` strips the `::ffff:` prefix Node adds to an IPv4 address on a dual-stack socket,
and `isLoopback` recognizes `127.0.0.1`/`::1` — a request from the same machine as the server has
no real client IP to geolocate, so `location.service.ts` returns the default city with reason
`"local-development"` immediately, without ever calling ipapi.co.

**Matching the provider's answer to the catalogue.** ipapi.co returns a free-text city name and
an ISO country code, which won't necessarily agree with this app's own `name` field on
diacritics or casing (e.g. "Sao Paulo" vs. "São Paulo", or "Sibenik" vs. "Šibenik" — see the
catalogue's own diacritic city, added and verified for exactly this reason).
`domain/normalize-city-name.ts` strips diacritics and normalizes case before comparing, so
`findCityByNameAndCountry` matches despite the difference. If the provider's city genuinely isn't
one of the catalogue's ~10, the backend synthesizes a one-off `{id: "detected", ...}` city from
the provider's own coordinates and name, which the frontend inserts at the top of the dropdown
rather than forcing a match against a small curated list — a real location that just isn't
pre-curated shouldn't be treated as a lookup failure.

**Every other failure looks identical from the outside.** A genuine ipapi.co outage or rate
limit (`UpstreamError`, a real non-2xx/timeout) and the provider's own `{error: true, reason:
"..."}` body for a reserved/invalid IP (see [Architecture overview](#architecture-overview) for
why that needs its own handling) both map to the same `source: "default", reason:
"lookup-failed"` — there's no caller that would do anything differently with a more specific
reason. A failure is logged server-side (`console.warn`, not `console.error` — this is an
expected, already-handled outcome, not the kind of bug `middleware/error-handler.ts`'s 5xx
logging exists to flag) without ever including the IP address itself, since an IP is personal
data that doesn't need to end up in logs for this to work.

**Frontend provenance.** `TravelPlannerPage` shows "Detected from your IP" when `source` is
`"ip"`, or "Couldn't detect your location, showing {city}" when it falls back — so the fallback
is honestly labelled, not presented as if it were a real detection. The notice is cleared the
moment the user manually picks a different city, since at that point it no longer describes
anything that's still true. Detecting the location is fetched independently of the city catalogue
and never surfaced as a page-level error if it fails outright (as opposed to gracefully falling
back) — the same split-endpoints reasoning as weather and description: a `GET /api/location`
failure should degrade to "pick the first catalogue city," silently, rather than block the rest
of the app.

**`DEFAULT_CITY_ID` is validated at startup, not at request time.** `config/env.ts` checks it
against the real catalogue (`domain/city-catalogue.ts`) via `findCityById` and refuses to start
if it's not a real id — the same "fail fast on a typo" philosophy as every other required env
var, rather than only discovering the mistake the first time detection needs to fall back to it.

## Timezone / date handling

The core mechanism landed in Stage 4, alongside the weather endpoint; Stage 7 adds the actual
forecast-date picker on top of it.

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
in `WeatherReport`, and compared directly as strings for the Stage 7 range check (`"2026-09-27" <
"2026-10-02"` sorts the same as it compares chronologically — no `Date` parsing needed for the
comparison itself). `new Date("2026-09-25")` parses as UTC midnight; naively formatting that in
the browser's own time zone can silently shift the displayed date by a day for any browser west
of UTC. The frontend's `lib/iso-date.ts` avoids this by explicitly formatting with `timeZone:
"UTC"` wherever an ISO _date_ string needs a human-readable label (`formatWeekday`,
`formatFullDate`) — their tests demonstrate the exact bug by comparing against Honolulu
(UTC-10), which really does render one day off without that pin.

**`formatLocalTime` (sunrise/sunset) needs the opposite treatment, deliberately.** Unlike
`localDate`, Open-Meteo's `sunrise`/`sunset`/`observedAt` fields are timezone-_less_ local
datetimes (e.g. `"2026-10-02T07:38"`, no offset) — the city's own wall-clock time, already
correct as written. Pinning `timeZone: "UTC"` here would be wrong: `new Date(...)` parsing a
string with no offset already treats it as local time in whatever zone the runtime happens to be
in, and formatting with _no_ explicit `timeZone` uses that same zone — the two cancel out,
displaying the given wall-clock time unchanged regardless of the browser's own zone. Confirmed
directly, not assumed: formatting the same string under three different `TZ` settings
(UTC, Pacific/Honolulu, Asia/Tokyo) produced the same "7:38 AM" every time.

**The forecast-date picker (Stage 7).** `GET /api/weather` takes an optional `?date=` query
param — Zod validates it's a real calendar date (a regex alone would accept "2026-02-30";
`controllers/travel.controller.ts`'s schema actually constructs the date and checks it
round-trips) — and `weather.service.ts` checks it against that city's own
`allowedForecastDates` before attaching the matching day as `selectedDay`, throwing a
`ForecastDateOutOfRangeError` (400, with the valid range in `details`) otherwise. The frontend's
`<ForecastDatePicker>` binds a native `<input type="date" min max>` to that same range — most
browsers grey out or refuse out-of-range dates directly in their own date-picker UI, a real,
zero-JavaScript layer on top of the backend's validation, never a replacement for it, since a
client can always send a `date` directly to the API regardless of what the input allows.

**Switching cities always clears the selected date** (`TravelPlannerPage`'s `handleCityChange`) —
deliberately, even for a date that happens to still be in range for the new city. A forecast
date is a choice about a specific city's calendar; carrying it silently across a city switch
would be more surprising than resetting to "current + week only" and asking the user to pick
again. This also means a city switch never sends the old date in its very first request for the
new city, so there's no wasted round trip to a range the new city might reject anyway.

**A date can still become invalid without any city change** — its allowed range is relative to
that city's own local "today", which moves forward on its own as real time passes, independent
of anything the user does. Rather than have the frontend track a clock to predict this,
`TravelPlannerPage` lets the request go through and recovers from the one error code that means
specifically that (`FORECAST_DATE_OUT_OF_RANGE`): it silently clears the date and lets
`useCityData` refetch without it — enforced by the one place that actually knows the current
range (the server), not guessed at by the client.

## API overview

| Method & path                                                     | Auth               | Purpose                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                     | none               | `{ "status": "ok" }` — used by the hosting platform's health check                                                                                                                                                                  |
| `POST /api/auth/login`                                            | none, rate-limited | `{email,password}` → `200 {accessToken, expiresIn, user}`; 400 bad body; 401 invalid credentials                                                                                                                                    |
| `GET /api/cities`                                                 | Bearer             | `200 City[]`, sorted alphabetically by name — the static catalogue, see [Database / migrations](#database-migrations)                                                                                                               |
| `GET /api/weather?latitude={n}&longitude={n}[&date={YYYY-MM-DD}]` | Bearer             | `200 WeatherReport`; 400 invalid/out-of-range coordinates or a malformed/nonexistent `date`; 400 `FORECAST_DATE_OUT_OF_RANGE` for a real date outside `allowedForecastDates` (range in `details`); 502/504 on an Open-Meteo failure |
| `GET /api/city-description?title={string}`                        | Bearer             | `200 CityDescription`; missing/disambiguation page → `200` with `description: null` (not an error); 400 missing title; 502/504 on a Wikipedia failure                                                                               |
| `GET /api/location`                                               | Bearer             | `200 DetectedLocation`; every detection failure (local dev, provider outage/rate-limit, an IP it can't place) is a `200` fallback, never an error, see [IP-based geolocation](#ip-based-geolocation)                                |

Every route except `/health` and `/api/auth/login` requires a valid `Authorization: Bearer`
header. Every error response uses the same envelope:
`{ "error": { "code": "SOME_CODE", "message": "...", "details"?: [...] } }`.

**`WeatherReport`** (see `services/weather.service.ts` for the exact TypeScript types):
`{ timezone, localDate, allowedForecastDates: {min, max}, units, current: {observedAt,
temperature, feelsLike, humidity, windSpeed, isDay, condition: {code, label}}, week:
DailyForecast[7], selectedDay? }`, where each `DailyForecast` is `{ date, condition,
temperatureMax, temperatureMin, precipitationProbabilityMax, sunrise, sunset }`. `selectedDay`
(Stage 7) is present only when a valid `date` was requested — the matching entry from `week`,
pulled out for convenience so the frontend doesn't have to search the array itself.

**`CityDescription`** (see `services/description.service.ts`): `{ title, description: string |
null, sourceUrl: string | null }`. `description` is Wikipedia's `extract`, truncated at a word
boundary to 280 characters (`domain/truncate-text.ts`) rather than cut mid-word; `sourceUrl` is
the page's canonical URL, used for the "Read more on Wikipedia" attribution link. Both are
`null` together, deliberately, when Wikipedia has no article for the title or the title resolves
to a disambiguation page — treated as a normal "nothing to show" outcome, not an error (a real
outage is what returns 502/504 instead).

**`DetectedLocation`** (see `services/location.service.ts`): `{ city: City, source: "ip" |
"default", reason?: "local-development" | "lookup-failed" }`. `city` is either a real catalogue
entry or a one-off `{id: "detected", ...}` city synthesized from the provider's own answer — see
[IP-based geolocation](#ip-based-geolocation) for the full detection flow and why every failure
mode still returns `200`.

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

| Variable                   | Required | Default                                        | Purpose                                                                                                                                                                                                                                                                            |
| -------------------------- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | no       | `development`                                  | `development` \| `test` \| `production`                                                                                                                                                                                                                                            |
| `PORT`                     | no       | `3000`                                         | HTTP port the API listens on                                                                                                                                                                                                                                                       |
| `CORS_ORIGINS`             | no       | `http://localhost:5173`                        | Comma-separated list of origins allowed to call the API from a browser                                                                                                                                                                                                             |
| `DATABASE_URL`             | **yes**  | —                                              | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/db`                                                                                                                                                                                                             |
| `JWT_SECRET`               | **yes**  | —                                              | HS256 signing secret for access tokens; at least 32 characters                                                                                                                                                                                                                     |
| `ACCESS_TOKEN_TTL_SECONDS` | no       | `900` (15 min)                                 | How long an access token stays valid, in seconds                                                                                                                                                                                                                                   |
| `OPEN_METEO_BASE_URL`      | no       | `https://api.open-meteo.com`                   | Base URL for the weather client — overridden in integration tests to point at a local stub, never at the real API                                                                                                                                                                  |
| `WIKIPEDIA_BASE_URL`       | no       | `https://en.wikipedia.org`                     | Base URL for the description client — same overridable-for-tests reasoning as `OPEN_METEO_BASE_URL`                                                                                                                                                                                |
| `WIKIPEDIA_USER_AGENT`     | no       | a local-dev-only placeholder, no personal info | Sent as the `User-Agent` header on every Wikipedia request, per [Wikimedia's policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy) — set this to a real contact URL for production; see [Why these external APIs](#why-these-external-apis) |
| `IP_GEOLOCATION_BASE_URL`  | no       | `https://ipapi.co`                             | Base URL for the IP-geolocation client — same overridable-for-tests reasoning as the other two base URLs                                                                                                                                                                           |
| `DEFAULT_CITY_ID`          | no       | `calgary`                                      | The city shown when IP detection can't run or doesn't produce a usable result — must be a real id in `domain/city-catalogue.ts`, checked at startup; see [IP-based geolocation](#ip-based-geolocation)                                                                             |
| `TRUST_PROXY_HOPS`         | no       | `0`                                            | Reverse-proxy hop count for Express's `trust proxy` setting; `0` for local dev (no proxy), `1` in production behind Render's own load balancer — see [IP-based geolocation](#ip-based-geolocation) for what this number actually does and why it was verified empirically          |

Not validated by `config/env.ts` (read directly by their respective one-off scripts, not by the
running server): `TEST_DATABASE_URL` (integration tests and `db:migrate:test`), `SEED_USERS`
(`db:seed` — format `"email1:password1,email2:password2"`, see
[Authentication](#authentication)).

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
npm run e2e            # Playwright — separate from npm test, see below
```

Backend integration tests require `TEST_DATABASE_URL`, pointed at a database with migrations
already applied (`npm run db:migrate:test -w @jambo/api`) — see
[Local setup](#local-setup). Without it, the integration test suite fails immediately with a
message saying so, rather than a confusing connection error. CI provisions a PostgreSQL
service container and runs the migration automatically before tests.

**`npm run e2e`** (Stage 9) is deliberately separate from `npm test` — it spins up real backend
and frontend dev servers plus two stub upstream servers (see
[Testing strategy](#testing-strategy)), which takes a few seconds even when everything's
already warm, unlike the near-instant unit/integration suite. It needs the same
`TEST_DATABASE_URL` as the integration tests (reused, not a separate database — see
`e2e/global-setup.ts`) and, once per machine,
[Playwright's browser binary](https://playwright.dev/docs/browsers):

```bash
npx playwright install --with-deps chromium
```

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

**Stage 5 adds:** the Wikipedia mapper, tested against real captured response shapes for a
normal page (Calgary), a disambiguation page (Mercury), and a 404 — all three collapse to
`{description: null, sourceUrl: null}`, so the test asserts that collapse explicitly rather than
just the happy path; `truncate-text.ts`'s word-boundary cut (unchanged under the limit, cut
exactly at the limit, mid-word avoided, and the no-space-found fallback); and `fetchJson`'s
`notFoundReturnsNull` overload, covered for both the `true` and default/`false` cases so a
regression there would fail loudly rather than silently returning `null` somewhere a caller
isn't expecting it.

**Stage 6 adds:** `domain/client-ip.ts` (the `::ffff:` prefix stripped, plain IPv4/IPv6 left
alone, both loopback forms recognized) and `domain/normalize-city-name.ts` (diacritics stripped,
case-insensitive, confirmed to make "Sao Paulo"/"São Paulo" and "Sibenik"/"Šibenik" compare
equal); `clients/ip-geolocation/mapper.ts`, covering ipapi.co's own `{error: true}` body
alongside a "successful" response missing a field it needs — both collapse to the same `null`, on
purpose, the same way Wikipedia's disambiguation/404 cases do; and `location.service.ts`'s full
decision tree with a fake client — loopback short-circuits before the client is ever called
(asserted directly, not just inferred from the result), a thrown error and a mapped `null` both
land on the same default-city fallback, a name+country match returns the catalogue entry, and a
non-match returns a synthesized `{id: "detected", ...}` city.

**Stage 7 adds:** `weather.service.ts`'s date handling, with a 7-day fixture built once and
reused — attaching `selectedDay` for a requested date that matches a real entry; both boundaries
of `allowedForecastDates` accepted (today and today+5); a date one day _before_ the range and one
day _after_ it (today+6 — a real day Open-Meteo returned and that's sitting right there in
`week`, but one day narrower than what the picker is allowed to request) both rejected with
`ForecastDateOutOfRangeError`; and the thrown error's `details` asserted to actually carry the
valid range, since that's what the frontend's recovery logic depends on. The calendar-date Zod
schema (`controllers/travel.controller.ts`) is exercised through the integration suite below
rather than in isolation, matching how `weatherQuerySchema`'s lat/lon checks already were.

**Integration tests** live under `apps/api/test/` and exercise the whole wired-up app over
real HTTP with Supertest. `POST /api/auth/login` runs against a real PostgreSQL database rather
than a mock, since a mock can't catch a mismatch between a migration's columns and a
repository's SQL the way an actual query does; `/api/cities` and `/api/weather` need no
database at all, so they're tested with a fake `WeatherService` injected via `createApp()`'s
dependencies instead — including the Bearer-protection coverage (missing/invalid/valid token)
that Stage 2 had deferred for lack of a real protected route to test against, and the
structured-502/504 response `middleware/error-handler.ts` produces when the weather service
reports an upstream failure. `/api/location`'s tests include the app's numeric `trust proxy`
setting end to end, over a real Supertest request rather than a unit test of Express's own
internals: with `TRUST_PROXY_HOPS=1` and a spoofed leftmost `X-Forwarded-For` entry, the location
service receives the correct (rightmost, actually-observed) address — the exact behavior verified
empirically while designing the feature, now pinned down as a regression test — and with
`TRUST_PROXY_HOPS=0` (the local-dev default), the header is ignored entirely. `/api/weather`'s
Stage 7 tests cover the full validation chain over real HTTP: a valid `date` reaching the service
unchanged, a malformed one (`09/27/2026`) and a nonexistent one (`2026-02-30`, a fake fixture
never even having to model a leap year for this to matter) both rejected as `VALIDATION_ERROR`,
and a service-level `ForecastDateOutOfRangeError` surfacing as `400` with `FORECAST_DATE_OUT_OF_RANGE`
and the valid range in `details` — the same shape `TravelPlannerPage`'s frontend recovery logic
is written against.

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

**Stage 5 adds** `useCityDescription`, structured identically to `useCityData` and given the
same stale-response race test (a slow title lookup and a fast one, switching before the slow
one resolves) — written as its own test rather than assumed to work just because `useCityData`'s
version passes, since the two hooks don't share an implementation. `CityDescriptionCard` is
tested for both states it can render: description text with a "Read more on Wikipedia" link
(asserting `href`, `target="_blank"`, and `rel="noopener noreferrer"` explicitly, since a
missing `rel` on a `target="_blank"` link is a real, if minor, security gap — see
[Security considerations](#security-considerations)) and the named empty state used when
`description` is `null`, asserted to _not_ render an error or a link. Because the description
and weather cards fetch independently, one existing `TravelPlannerPage` test (a weather-only
upstream failure) surfaced a gap the first time it was run against the new hook: MSW had no
default handler for `/api/city-description` yet, so that request failed too, producing two
error alerts where the test expected one isolated failure. Fixing that meant adding a default
success handler for the endpoint (`test/msw/handlers.ts`) — the kind of test-infrastructure gap
that only shows up by actually running the suite, not by reading the new code in isolation.

**Stage 6 adds** location-driven default-selection tests on `TravelPlannerPage`: an IP-detected
city already in the catalogue is selected with a "Detected from your IP" notice; a detected city
_not_ in the catalogue is inserted at the top of the dropdown and selected; a provider fallback
shows the honestly-worded "Couldn't detect your location" notice rather than an error; a total
`/api/location` failure falls back to the first catalogue city silently, with no visible error or
notice, since detecting a location is a nice-to-have default, not a feature the user asked to see
fail; and a manual city change clears a previously-shown notice, since it no longer describes
anything true. The default MSW handler for `/api/location` (`test/msw/handlers.ts`) deliberately
returns the same city as `MOCK_CITIES[0]`, so every test written before Stage 6 keeps passing
unchanged rather than needing to also mock an endpoint it was never about.

**Stage 7 adds** `useCityData`'s `date` parameter and `errorCode` field: a rerender with a new
date triggers a real refetch (asserted against the actual query string an MSW handler receives,
not just that _a_ request happened), and a `FORECAST_DATE_OUT_OF_RANGE` response is asserted to
surface through `errorCode` distinctly from the human-readable `error` message, since
`TravelPlannerPage`'s recovery logic switches on the former. `ForecastDatePicker` and
`SelectedDayCard` each get focused rendering tests (`min`/`max`/`value` wiring, `onChange` firing
with the typed date or `null` on clear; rounded temperatures, the condition label, and
sunrise/sunset formatted as local wall-clock times). `TravelPlannerPage`'s two most important
Stage 7 tests: picking a date renders the selected-day card with the right data (scoped with
`within()`, since the same day's temperature is _also_ visible in the still-rendered week strip —
an ambiguous-query trap the test deliberately avoids rather than accidentally passing for the
wrong reason); and picking a date, then switching cities, confirms the date resets to empty and
the switch's own weather request never carries the old date at all (asserted against the actual
query string, not just the UI's end state) — the proactive-clearing behavior added in Stage 10.
A separate test drives the _reactive_ fallback directly, without any city change: the same
city's allowed range shifting between one request and the next (e.g. time passing) still
recovers via `FORECAST_DATE_OUT_OF_RANGE`, reproduced as a real race between a user action and a
server rejection rather than only argued for in prose.

**End-to-end (Stage 9), `e2e/`, is a different kind of test from everything above** — real
backend and frontend dev servers, a real (test) database, and a real Chromium browser driven by
[Playwright](https://playwright.dev), rather than fakes/mocks/jsdom. The one thing that's
_not_ real is the external upstreams: `e2e/stub-servers.ts` runs plain `node:http` servers
standing in for Open-Meteo and Wikipedia, so the suite never depends on (or is ever flaky
because of) a live third party — the exact problem the project plan's R11 risk flagged before
this stage was built. `IP_GEOLOCATION_BASE_URL` points at a deliberately unreachable
`.invalid` host with _no_ stub behind it at all: Playwright's browser connects to the backend
over loopback with `TRUST_PROXY_HOPS=0`, so `location.service.ts`'s `isLoopback()` check
short-circuits before that URL would ever be requested — if that assumption were ever broken by
a future change, this would fail loudly (a connection error) instead of silently reaching a
real API.

`e2e/fixtures.ts` centralizes every value the stub servers return and the spec asserts on, so
(for example) Calgary's fixture temperature is defined exactly once and referenced by both
sides — a mismatch between "what the stub sends" and "what the test expects" isn't possible by
construction. `e2e/global-setup.ts` runs the backend's own migration script against
`TEST_DATABASE_URL` (reused from the integration suite, not a separate database — see
[Running tests](#running-tests)) and seeds one fixed demo account, truncating `users` first so a
stale row from an earlier run can never make the login step flaky.

The one spec (`tests/happy-path.spec.ts`) walks the full path a reviewer would actually take:
log in → the default city (Calgary, via the real loopback/local-development detection path)
loads with real description/current/week data → switch to a second city (Tokyo) and confirm the
_displayed_ data actually changes, not just the dropdown's value → pick a forecast date and
confirm the selected-day card shows that specific day's distinct fixture temperature, proving
the date picker drives a real request/response round trip end to end. This was verified to
actually catch a regression, not just pass vacuously: deliberately corrupting a fixture value
made the test fail with a clear, real diff between expected and rendered text, then passed
clean again once reverted.

**Stage 10 adds:** `city-catalogue.test.ts` asserts `listCities()`'s output is actually sorted
(compared against a fresh `localeCompare` sort of the same names, not hand-typed expected
strings that could drift), plus a dedicated check that a diacritic city (Šibenik) lands in its
correct alphabetical position rather than after every plain-ASCII name. `TravelPlannerPage`'s
date-clearing behavior split into two tests matching the two distinct code paths that can now
clear a date: switching cities (asserted against the actual query string the new city's weather
request carries — proving the date is cleared _before_ that request goes out, not just that the
UI resets afterward) and the same city's allowed range shifting without any city change (the
narrower, `FORECAST_DATE_OUT_OF_RANGE` recovery path). `App.test.tsx` gained the two Accessibility
section assertions (a real `<h1>`, and that focus actually lands on it after login) — the focus
one confirmed to catch a real regression by temporarily breaking it and watching the test fail.

## Deployment architecture

```mermaid
flowchart LR
  B["Browser"] -->|"HTTPS"| V["Vercel: static React build"]
  V -->|"Authorization: Bearer JWT"| R["Render: Express API"]
  R --> N[("Neon: PostgreSQL")]
  R --> OM["Open-Meteo"]
  R --> WK["Wikipedia"]
  R --> IP["ipapi.co"]
```

Three free tiers, each on its own default domain (`*.vercel.app`, `*.onrender.com`,
`*.neon.tech`) — no custom domain, which is a deliberate non-decision rather than an oversight:
the core (Stages 0–7) authenticates with a Bearer header, not a cookie, so it isn't subject to
the third-party-cookie restrictions that would make same-site custom subdomains matter (see
[Authentication](#authentication)). A custom domain remains an option to revisit only if the
optional refresh-token cookie enhancement is ever added.

**Build-time vs. runtime environment variables — a real distinction, not a technicality.**
Vite bakes `VITE_API_BASE_URL` into the built JS at _build_ time (`import.meta.env.*` is
replaced with a literal value during `vite build`), unlike the backend's env vars, which
`config/env.ts` reads at every process _start_. Changing the Vercel project's env var alone
doesn't change what an already-built bundle points at — it takes an actual rebuild. This was a
real gotcha during setup, not a theoretical one: the first Vercel deploy had
`VITE_API_BASE_URL` pointing at the wrong URL, and the fix required a full redeploy, not just
an env var edit — confirmed by grepping the actual served JS bundle for the literal URL string
before and after.

**Render's Node buildpack skips `devDependencies` under `NODE_ENV=production`**, which is also
the value this app's env schema expects for the deployed environment (`config/env.ts`,
`NODE_ENV: "development" | "test" | "production"`). Since the build step (`tsc`) needs
`typescript`/`@types/node` — both devDependencies — to compile, the Build Command explicitly
overrides that with `npm install --include=dev`, so the build gets what it needs while the
running process still reports `NODE_ENV=production` correctly.

- **Build Command:** `npm install --include=dev && npm run build -w @jambo/api`
- **Start Command:** `npm run start -w @jambo/api`

**`TRUST_PROXY_HOPS=1` in production, verified against the real deployment, not just locally.**
Render sits exactly one reverse proxy in front of this app, matching the hop count the
[IP-based geolocation](#ip-based-geolocation) section's empirical verification was built for.
Confirmed for real once deployed: a request through Render's real proxy chain resolves to
`source: "default", reason: "lookup-failed"` from `/api/location` (a real external IP correctly
recognized as _not_ loopback, whose provider lookup then failed gracefully) — not
`reason: "local-development"`, which is what a misconfigured hop count that collapsed every
request to an internal address would have produced instead.

**Environment variables actually set on Render** (see [Environment variables](#environment-variables)
for what each one does): `NODE_ENV=production`, `DATABASE_URL` (Neon's pooled connection
string), `JWT_SECRET` (a real random secret, generated once for this deployment — never the
local-dev one), `ACCESS_TOKEN_TTL_SECONDS=3600` (not the 15-minute dev default — see
[Trade-offs](#trade-offs) for why, now that the refresh-token enhancement is out of scope for
this submission), `TRUST_PROXY_HOPS=1`, `DEFAULT_CITY_ID=calgary`, `WIKIPEDIA_USER_AGENT` (set
to a real, reachable contact — this repository's own GitHub URL — rather than a personal email,
continuing the Stage 5 decision), and `CORS_ORIGINS` (the Vercel deployment's exact origin, no
trailing slash — a trailing slash or an accidentally-blanked value both silently reject every
origin, including the correct one, which is exactly what happened once during setup and was
caught by comparing the response to a deliberately wrong `Origin` header for contrast).

**Neon migrations and seeding** were run once, directly against the production `DATABASE_URL`,
the same `npm run db:migrate -w @jambo/api` / `npm run db:seed -w @jambo/api` commands used
locally — no separate production migration tooling, since `node-pg-migrate` already works
against any reachable PostgreSQL connection string.

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

**Device geolocation as a more accurate alternative on cellular networks.** IP-based
geolocation (the current approach — see [IP-based geolocation](#ip-based-geolocation)) is
noticeably less reliable for a phone on cellular data than for a laptop on home wifi: carriers
route mobile traffic through centralized gateways that don't correspond to the device's actual
location, so the IP maps to wherever the carrier's gateway is, not the user. This isn't
hypothetical — it's a known, common failure mode (e.g. a Rogers customer's IP can resolve to a
city far from where they actually are, and real retail sites' store-locator features get this
wrong for the same reason). The fix is the browser's own `navigator.geolocation` API (GPS/wifi-
based, resolved on-device), which is meaningfully more accurate — but it's a real trade-off, not
a strict upgrade: unlike the current silent IP lookup, it requires an explicit browser permission
prompt the user can deny, and works only in a secure (HTTPS) context (already true here). The
likely design: try `navigator.geolocation.getCurrentPosition()` first, with a short timeout, and
fall back to the existing IP-based detection if it's denied, times out, or the browser doesn't
support it — so the app degrades to today's exact behavior rather than requiring the permission
to function at all.

**A small TTL cache in front of the three upstream clients** (`clients/open-meteo/`,
`clients/wikipedia/`, `clients/ip-geolocation/`) — deliberately not built for this submission
(see [Trade-offs](#trade-offs)), but the design was thought through: an in-memory `Map` keyed by
the request's own parameters, with a TTL chosen per how often each value actually changes —

| Cached call               | Cache key                                                                                  | TTL         | Why that TTL                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Weather (Open-Meteo)      | `latitude,longitude` (rounded — the same city is always requested at the same coordinates) | ~10 minutes | Weather itself doesn't meaningfully change minute to minute, and this is the call most likely to get rate-limited under real traffic (confirmed firsthand during Stage 3.5's deployment verification — Open-Meteo's own free tier returned a real `503 "The service is overloaded"`) |
| Description (Wikipedia)   | the requested `title`                                                                      | ~24 hours   | Article text changes rarely; there's no reason to re-fetch the same city's description more than about once a day                                                                                                                                                                    |
| IP geolocation (ipapi.co) | the normalized client IP                                                                   | ~24 hours   | A given IP's city rarely changes within a day, and this is the upstream with the tightest free-tier quota — confirmed firsthand too (ipapi.co's free tier was already exhausted, a real `429`, from two independent networks while building Stage 6)                                 |

The reason this stayed out rather than getting built anyway: a per-process `Map` is trivial for
a single Render instance (this deployment), but wouldn't be correct behavior with more than one
instance (each would have its own cache, so cache hit rate — and staleness — would depend on
which instance happened to handle a given request); a real multi-instance deployment would want a
shared store (Redis) instead, which is real infrastructure this take-home doesn't have a
justified reason to add. Documented here so the reasoning exists even without the code.

**Refresh tokens** (Stage 8 in the original plan, dropped for time — see
[Authentication](#authentication)): an opaque token in an HttpOnly cookie, rotated on use, so a
page reload doesn't require signing in again. The core's 60-minute access token
(`ACCESS_TOKEN_TTL_SECONDS`, see [Deployment architecture](#deployment-architecture)) is the
accepted stand-in for now.

**Smaller items**, roughly in the order they'd be worth doing: a change-password flow (there's
currently no account management at all beyond the seeded demo user); per-user/per-IP API rate
limits, not just the login rate limiter; a °C/°F toggle; an hourly (not just daily) forecast for
the selected day; a tuned Content-Security-Policy beyond Helmet's defaults; a second IP
geolocation provider as a fallback when ipapi.co's own quota is exhausted; and, if the two apps'
shared types ever grow past the current handful of interfaces, a shared contract package (or
generated OpenAPI client) instead of the current duplicated-by-hand types.
