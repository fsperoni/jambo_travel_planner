# AI usage log

This is a running log of how AI tools were used while building this project, kept during
development rather than reconstructed afterward, per the assignment's AI use policy. It's
summarized in the [README's AI usage section](./README.md#ai-usage).

For every entry: I (Fabio) reviewed the output to understand it, and made final decisions. Where I changed or rejected something AI proposed, that's noted
explicitly - those are usually the more interesting parts of this log.

## Tools used

- **Claude Code** - primary assistant for planning, scaffolding, implementation,
  and code review throughout this project.
- **ChatGPT** - used ad hoc for secondary review of specific decisions where noted.
- **OpenAI Codex** - used for one dedicated, independent adversarial review pass near
  submission (see the 2026-09-27 "Codex review response" entry below), separate from
  Claude Code's own day-to-day work.

## 2026-09-24 - Planning

**Tool:** Claude Code.

Worked through the assignment PDF, the job description, and my resume with Claude Code to
turn a set of technology preferences I already had (React/TS frontend, Node/TS/Express
backend, PostgreSQL, JWT with refresh tokens, Open-Meteo, Wikipedia, ipapi.co) into a concrete
implementation plan: a requirement checklist against the actual assignment text, a risk list
(cross-site cookies and Safari/Incognito, CSRF/XSS implications of the token architecture,
`trust proxy` / client-IP spoofing, date-only timezone bugs), a REST API design, a PostgreSQL
schema, a staged implementation order, and a test matrix.

Claude Code also fetched and cross-checked current provider documentation before I let any of
it shape the plan: Open-Meteo's forecast parameters and `timezone=auto` behaviour, ip-api.com's
and ipapi.co's free-tier terms (HTTP-only vs HTTPS, rate limits - this is why ipapi.co was
chosen over ip-api.com), and whether the Wikipedia REST summary endpoint is on Wikimedia's
deprecation list (it isn't, as of the check date).

**What I changed or pushed back on** (first review pass): I rejected the initial "5-day
Haversine-distance city snapping" idea for IP geolocation - it introduces an arbitrary
geographic threshold I'd have to justify in the walkthrough for no real benefit;
exact name+country matching against the catalogue is simpler and just as defensible. I also
cut the initially-proposed multi-account demo-user strategy, the `ipaddr.js` dependency
(Node's built-in `node:net` covers the actual need), and deferred several auth features
(refresh-token family/reuse detection, multi-tab coordination) that added complexity without
adding anything I'd want to be tested on.

**What I changed** (second review pass): dropped change-password from scope entirely
(documented as a "with more time" item instead - one seeded demo account has no
password-collision problem if it can't be changed),
fixed a `docker-compose.yml` assumption I didn't actually want (no Docker requirement; any
local PostgreSQL 16+ via `DATABASE_URL`), and moved the optional 5-day-forecast feature into
the core milestone rather than treating it as a late add-on, since we'd already decided to
build it.

The full plan (architecture diagrams, schema, endpoint list, sequence diagrams, staged order,
testing matrix, and the list of likely walkthrough questions we prepared for) is preserved in
the session's plan file and reflected incrementally in the README as each stage lands.

## 2026-09-24 - Stage 0: project scaffold

**Tool:** Claude Code.

Generated the npm-workspaces monorepo skeleton: root and per-app `package.json`s, TypeScript
project configuration (a shared `tsconfig.base.json`, `NodeNext` module resolution for the
API, project-referenced `bundler` resolution for the Vite frontend), one shared ESLint flat
config covering both apps, Prettier, the Vite + React + Vitest + React Testing Library setup
for the frontend, Vitest for the backend, and the GitHub Actions CI workflow (lint, typecheck,
test on every push, with a PostgreSQL service container provisioned from the start since
Stage 2's integration tests will need it).

Dependency versions weren't guessed - for each package, Claude Code checked the npm registry
for the current latest version and, where a package had a very recently released major (Vite
8, Vitest 5, TypeScript 7), checked its release date and deliberately picked the previous,
more battle-tested major instead (Vite 7, Vitest 4, TypeScript 5.9) for a project I need to
run reliably and explain rather than showcase the newest tooling. `@types/node` was pinned to
the `24.x` line to match the installed Node LTS rather than the registry's default-latest
(`26.x`, ahead of what's actually installed). One real compatibility issue surfaced and was
fixed in the process: `@vitejs/plugin-react@6` requires Vite 8, so the frontend uses
`@vitejs/plugin-react@5` (which supports Vite 7) instead.

I decided against `eslint-plugin-react-hooks`'s full `recommended-latest` preset in favor of
picking two specific rules (`rules-of-hooks`, `exhaustive-deps`) - the full preset bundles a
set of React Compiler-oriented rules (e.g. `purity`, `immutability`) that don't apply since
this project doesn't use the React Compiler, and I didn't want lint rules in the config I
couldn't explain the purpose of.

I kept linting lightweight and run `tsc --noEmit` separately for type correctness. Type-aware ESLint can catch additional semantic issues, but enabling the full type-checked ruleset adds configuration and linting cost. For this small take-home I chose a focused ESLint configuration, and I'd selectively add type-aware rules such as no-floating-promises if justified.

Verified locally rather than assumed: `npm install`, `npm run lint`, `npm run typecheck`,
`npm test`, `npm run test:coverage`, and `npm run format:check` all run clean before treating
the stage as done.

## 2026-09-24 - Stage 1: API foundation

**Tool:** Claude Code.

Built the base Express app: `config/env.ts` (Zod-validated env, fails fast with a readable
error naming the offending variable), `app.ts` (`createApp(deps)`, no listener) and
`server.ts` (the actual bootstrap, plus graceful shutdown on SIGTERM/SIGINT), Helmet, a CORS
allowlist, an `AppError` base class with a central `errorHandler` middleware, and a
`validate()` middleware backed by Zod.

One real gotcha surfaced and got fixed rather than papered over: Express 5 made `req.query`
read-only (no setter) - confirmed by writing a two-line reproduction against the actual
installed Express version rather than assuming based on prior versions' behavior. Since
`req.body` and `req.params` are still writable, the easy path would have been to special-case
query differently from the other two. Instead, validated input for all three always goes
through one `req.valid` property, so there's one consistent place to read from regardless of
which part of the request it came from - documented inline in `types/express.d.ts` since it's
exactly the kind of thing worth explaining rather than leaving as an unexplained asymmetry.

**What I changed:** the initial `tsconfig.json` set both `rootDir: "src"` and included
`test`/`scripts` directories, which don't type-check together (TypeScript won't allow files
outside `rootDir`). Rather than force everything under `src`, split it: the main
`tsconfig.json` (used for `--noEmit` typechecking) has no `rootDir` and can see `test` and
`scripts`; `tsconfig.build.json` (the one that actually emits `dist/`) sets `rootDir: "src"`
and excludes `test`/`scripts`, so the compiled output only ever contains real server code.

Verified beyond the automated checks: ran the actual server with `tsx` (not just Supertest
against `createApp`), curled `/health` and a 404 route to see the real headers and JSON
envelope, then sent it a real `SIGTERM` and confirmed it logged the shutdown message and
exited instead of hanging or dropping the connection.

## 2026-09-25 - Final simplification pass (before Stage 2)

**Tool:** Claude Code.

Before continuing past Stage 1, I asked for one more review pass of the plan specifically
looking for over-engineering and "walkthrough traps" - places where I'd be defending
complexity that didn't earn its place for an Intermediate-level take-home. A few things got
cut or made conditional:

- **Refresh tokens (Stage 8) are now explicitly conditional**, not a fixed part of the
  submission. Stages 0-7 have to stand on their own as a complete, polished submission first;
  refresh tokens are an enhancement attempted only once that's true, not a dependency for
  satisfying the assignment. If skipped, a page reload just requires logging in again - no
  localStorage shortcut to fake persistence.
- **Removed the IP-range classification plan.** The original design had a hand-maintained
  `node:net.BlockList` covering RFC1918 ranges, link-local, CGNAT, etc. That's networking
  trivia with nothing to show for it at this project's scope - `trust proxy` plus the
  geolocation provider's own validation plus a graceful fallback covers the actual
  requirement ("use the IP, default sensibly") without a range catalogue I'd have to defend
  line by line.
- **Rate limiting scoped down to the login endpoint only** (and `/refresh`, if Stage 8
  happens). A general API-wide rate limiter was in the original plan; it adds configuration
  and `req.ip`/proxy interactions with no real problem behind it at this scale. I'd rather say
  "I rate-limited the auth endpoints; a production public API would get per-user/per-IP limits
  based on real usage" than defend an arbitrary global threshold.
- **The in-memory TTL cache is now explicitly optional and droppable**, not a committed
  feature. If it doesn't stay to about 20 lines, it doesn't ship - "the implementation calls
  upstream APIs directly" is a perfectly fine answer for a take-home.

**A concrete AI mistake, caught and fixed rather than shipped:** the plan's auth-flow diagram
was Mermaid `sequenceDiagram` syntax with a semicolon inside a message label
(`"...Secure, SameSite, Path=/api/auth"` - the parser reads `;` as ending the statement, so
the diagram didn't actually render. I wouldn't have caught this by reading the plan text; it
only showed up because I asked whether the diagrams actually render before trusting them for
the README. Replaced with two smaller, valid diagrams (the core Bearer flow, and the Stage 8
refresh flow) - simpler individually and actually checked to parse.

**What changed in already-written Stage 1 code as a result:** `app.ts` had `credentials: true`
on the CORS config, added in anticipation of the (now-conditional) refresh cookie. Removed it -
the Bearer header the frontend attaches doesn't need it, and shipping it before there's a
cookie that needs it is exactly the kind of thing I couldn't have defended if asked "why is
this here?" in the walkthrough. Updated the matching comments in `env.ts` and a few README
sentences that referenced the old assumption.

## 2026-09-25 - Stage 2: auth core

**Tool:** Claude Code.

Built the `users` migration, the user repository, bcrypt password hashing, the JWT token
service, the login-only rate limiter, `requireAuth`, and `POST /api/auth/login` end to end.

**Verified against a real database, not just typechecked.** Before writing any application
code against it, Claude Code actually ran the migration against a local PostgreSQL 17
instance: applied it, inserted a row with an uppercase email to confirm the
`users_email_lowercase_check` constraint genuinely rejects it (not just that the SQL looks
right), then ran the migration back down and confirmed the table was gone. Same standard
applied to the finished login endpoint - a real server, started with `tsx`, seeded with a real
user via the seed script, then hit with `curl` for the valid-login, wrong-password,
unknown-email, and malformed-body cases, plus twelve rapid login attempts in a row to confirm
the rate limiter actually returns 429 rather than just trusting that `express-rate-limit` was
configured correctly.

**A real tool gotcha, found by testing rather than assumed:** `node-pg-migrate`'s `--envPath`
flag (for loading a `.env` file) silently does nothing unless the `dotenv` package happens to
be installed - it's an optional peer the CLI soft-imports, and with no `dotenv` dependency in
this project (deliberately - the app itself uses Node's built-in `--env-file` instead), passing
`--envPath` just failed to set `DATABASE_URL` with no error at all. Caught by actually running
the migration command, not by reading the tool's `--help` output. Rather than add a dependency
just to unlock that flag, the migration scripts stick to the pattern node-pg-migrate's own
README documents as the primary way to use it: `DATABASE_URL=... npm run db:migrate`, with
`TEST_DATABASE_URL` handled via node-pg-migrate's own `-d` flag
(`db:migrate:test`: `node-pg-migrate up -d TEST_DATABASE_URL`) instead of a second script that
duplicates the first.

**What I changed:** an early draft of the auth-service tests used
`.rejects.toMatchObject({ constructor: UnauthorizedError, message: "..." })` to check both the
error type and its message in one assertion. That's not actually a reliable way to check
`instanceof` with `toMatchObject` (`constructor` isn't a normal own-enumerable property, so
the check doesn't verify what it looks like it verifies) - caught it before it shipped and
replaced it with two unambiguous assertions (`toBeInstanceOf` + `toThrow`) on the same promise
reference instead.

**A scope call, not a bug:** there's no protected route yet to write a true
"valid Bearer token → 200" integration test against — the first one (`/api/cities`) doesn't
land until Stage 4. Rather than invent a placeholder endpoint just to have something to test,
`requireAuth` gets full unit coverage in isolation (missing header, wrong scheme, invalid/
expired token, valid token) now, and the login integration test adds one more check: that the
token it issues actually verifies through the same `TokenService` a protected route will use.
The true end-to-end version lands with Stage 4, documented as such in the README rather than
left implicit.

**Also caught in review:** bcrypt's 72-byte password limit is a _byte_ limit, not a character
one - a naive `.length` check would pass a 40-character password made of "é" (2 bytes each in
UTF-8, 80 bytes total) straight through to silent truncation. The seed-user parser measures
with `Buffer.byteLength(password, "utf8")`, and there's a dedicated test using exactly that
multi-byte case rather than only testing with plain ASCII, where the character-vs-byte
distinction wouldn't show up at all.

**Caught by Fabio before committing:** `user.repository.ts` originally had a `UserRow`
interface plus a `mapRow()` function whose entire job was renaming pg's snake_case columns
(`password_hash`, `created_at`, `updated_at`) to the app's camelCase `User` type - noticed
while reviewing the diff that the function "only renames attributes" and asked whether it was
actually earning its place. It wasn't: PostgreSQL column aliases (`password_hash AS
"passwordHash"`) do the same renaming directly in the query, so `pool.query<User>(...)`
returns already-shaped rows with no separate mapping step. Removed `UserRow` and `mapRow`
entirely (~19 lines) and pulled the alias list into one shared `USER_COLUMNS` constant so the
`SELECT` and `INSERT ... RETURNING` queries can't drift out of sync with each other. The one
real trade-off, stated rather than hidden: a typo'd mapper field would have been a TypeScript
compile error, while a missing double-quote on a SQL alias (Postgres silently lowercases an
unquoted one) is only caught by the integration tests actually checking response shape - an
acceptable trade for a file with two queries, reverified by re-running the real integration
tests against PostgreSQL afterward rather than trusting the typecheck alone.

**Also caught by Fabio, on a different file:** asked directly whether `token.service.ts`'s
`ISSUER`/`AUDIENCE` constants were safe to commit, since they're sitting right in source next
to a security-sensitive file. Worked through it rather than just asserting an answer: wrote a
two-line repro that signs a token with the _wrong_ secret but the _correct_ issuer/audience and
confirmed `jwt.verify()` still rejects it (`invalid signature`) before it ever gets to checking
those claims. `iss`/`aud` are labels compared after the signature already passed, not part of
the cryptographic check itself - closer to a realm name than a credential. `JWT_SECRET`, the
thing that would actually matter if it leaked, was already correctly kept out of source (env
var, validated to be ≥32 characters at startup, gitignored `.env` locally).

## 2026-09-25 - Stage 3: web/auth foundation

**Tool:** Claude Code.

Built the frontend half of authentication: design tokens (`styles/tokens.css`), the
`api/http.ts` fetch wrapper (attaches `Authorization: Bearer`, distinguishes a 401 from an
authenticated request — session expired — from a 401 from the login endpoint itself — wrong
credentials), `AuthProvider`/`useAuth` (token in a `ref`, user in state, a `configureAuthHandlers`
registration to bridge `http.ts` and `AuthProvider` without a circular import), `LoginPage`
(with a `useDelayedFlag`-driven "the server may be waking up" notice for Render's free-tier
cold starts), and the `App.tsx` shell that swaps between them.

**A real gotcha, caught by actually running the suite, not by assuming it would pass:** the
first draft of `AuthProvider.test.tsx` and `LoginPage.test.tsx` failed everywhere _except each
file's first test_ - the DOM dump in the failure showed two copies of the same form stacked on
top of each other. React Testing Library normally deregisters (`cleanup()`) the previous
test's render automatically, but only by detecting a _global_ `afterEach` function - this
project deliberately never turned on Vitest's `globals: true` (explicit imports over magic
globals, the same call made back in Stage 0's ESLint setup), so that auto-detection silently
never fired, and every `render()` call within a file just kept adding to `document.body`.
Confirmed the actual mechanism by reading `@testing-library/react`'s own source
(`typeof afterEach === 'function'`) rather than guessing, then fixed it at the root: one
explicit `afterEach(() => cleanup())` in the shared test setup file, which is the direct,
correct consequence of the globals choice rather than a workaround for a bug in the library.

**What I changed after linting flagged it:** `AuthProvider.tsx` originally exported both the
`AuthProvider` component and the `useAuth` hook from one file - `react-refresh/only-export-components`
warned that this downgrades Vite's Fast Refresh to a full page reload for that file, since Fast
Refresh only hot-reloads files that exclusively export components. Rather than suppress the
warning (this project has generally fixed lint warnings at the root elsewhere, not silenced
them), split `useAuth` and the context object into their own file (`AuthContext.ts`), leaving
`AuthProvider.tsx` exporting only the component. Had to update every file importing `useAuth`
from the old location, including a test's `vi.mock(...)` target, which needs to match the exact
module path the component under test actually imports from - a mismatch there wouldn't error,
it would just silently mock nothing and let the real `useAuth` run instead.

**Verified beyond the test suite:** ran the real API server (from Stage 2, with the demo user
seeded then) and the real Vite dev server side by side, then used `curl` to send an actual CORS
preflight and a real login request with `Origin: http://localhost:5173` set - confirming the
frontend's default API URL and the backend's default CORS allowlist actually work together for
a real browser, not just inside MSW's mocked network layer, which never touches real CORS at
all.

**Correction requested by Fabio, after manual device testing:** on a 360px-wide viewport
(Chrome DevTools, Samsung Galaxy S8+ emulation), `AppHeader` looked broken - the title text
"Jambo Travel Planner" wrapped mid-phrase onto two lines while the email and logout button got
squeezed onto the same crowded row, caught by Fabio actually opening the app on a narrow
viewport and screenshotting it, not by anything in the test suite. This is a real gap in
automated coverage: jsdom (what the test suite runs against) doesn't perform real CSS
layout/flexbox computation, so no test written against it could have caught a wrapping bug at a
specific viewport width - this class of issue only surfaces by actually rendering the page.
Fixed `AppHeader.module.css`: `white-space: nowrap` keeps the title itself from wrapping
internally, and `flex-wrap` on the header lets the email+button block drop to its own row below
the title when there isn't room, instead of both fighting for space on one row. Also added
`text-overflow: ellipsis` truncation on the email while making the fix, since a real user's
email could be considerably longer than `demo@example.com` and would hit the same kind of
overflow the title did. Verified against the existing test suite (24 tests, still passing - none
of them exercise this layout, consistent with the point above) and confirmed visually by Fabio
re-checking the same device emulation afterward.

## 2026-09-25 - Stage 4: cities + weather

**Tool:** Claude Code.

Built the city catalogue, the Open-Meteo client/mapper, `GET /api/cities`, `GET /api/weather`,
and the frontend that consumes both: `CitySelect`, `CurrentWeatherCard`, `WeekForecast`,
`useCityData`, and `TravelPlannerPage`.

**Verified against the real API before writing the mapper, not from documentation alone:**
called `api.open-meteo.com` directly for Calgary's coordinates with the exact parameters
`client.ts` would use, and built `raw-types.ts`/the mapper's test fixture from that actual
response rather than what the docs describe. This is also how a real, non-hypothetical
demonstration of the whole timezone design ended up in the README: requesting Tokyo and Calgary
from the real running server at the same moment returned `localDate: "2026-09-26"` for Tokyo
and `"2026-09-25"` for Calgary - the exact "it's already tomorrow somewhere else" scenario the
`timezone=auto` design exists for, confirmed live rather than only argued for in the abstract.

**A real library behavior confirmed by testing, not assumed:** before writing `fetchJson`'s
timeout handling, ran a two-line repro against a real local HTTP server that never responds, to
see what `AbortSignal.timeout()` actually rejects with (a `DOMException` named `"TimeoutError"`,
which - also confirmed rather than assumed - passes `instanceof Error`), and separately confirmed
what a genuine connection failure looks like (`TypeError: fetch failed`). Both are exactly what
`fetchJson` branches on to decide between a 504 (timed out) and a 502 (unreachable/erroring) -
getting this distinction right depended on knowing the exact error shapes, not guessing at them.

**A design question worked through rather than defaulted on:** whether the Open-Meteo client
should take `fetchJson` as an injected dependency (matching the project's general preference for
DI over module mocking) or import it directly. Decided against injecting it - `client.ts`'s own
URL-construction logic isn't called out as needing a dedicated unit test in the project's testing
matrix (only the mapper and service orchestration are), and it's cheap, mechanical, low-risk glue
code, closer to how controllers are treated (tested through integration, not in isolation) than
to a real seam like the database `Pool`. Verified instead by actually calling the real API
through the real running server, end to end.

**What I changed after re-reading my own reasoning:** `weather.service.ts`'s dependency type was
first written as an inline anonymous shape (`{ getForecast(...): Promise<WeatherReport> }`)
because `client.ts` didn't exist yet when the service was drafted. Once it did, replaced the
inline shape with the real `OpenMeteoClient` type instead of leaving a duplicate definition
sitting there - the two would have been easy to let drift out of sync silently, since nothing
would fail to compile if they diverged (structural typing would still accept a matching object).

**A real gotcha, caught by running the test suite, not assumed away:** `iso-date.test.ts`'s
first draft used `process.env.TZ` to simulate a browser in a different time zone - that fails to
typecheck in `apps/web`, because the frontend's tsconfig deliberately has no Node types (it's
browser code; adding them project-wide would let `process`/`Buffer`/etc. silently compile inside
real application code too, which is exactly the kind of scope leak worth avoiding rather than
patching around). Rewrote the test to demonstrate the same bug without any Node-specific API:
formats the same instant with an explicit `timeZone: "Pacific/Honolulu"` passed directly to
`Intl`/`Date` (available identically in Node and the browser) and shows it prints "Thu" where
the UTC-pinned implementation correctly prints "Fri" - arguably a clearer test than the original,
since it demonstrates the wrong answer and the right one side by side in one place.

**A test bug caught before it shipped:** an early `TravelPlannerPage` test constructed a mock
weather report with `feelsLike` equal to `temperature`, then asserted on the text "10°C" -
which matched _two_ elements (the main temperature and the "Feels like" value), failing with a
"multiple elements found" error rather than the "text not found" I'd have expected from a real
bug. Fixed by making the fixture's values distinct, and left a comment in the test explaining
why they need to differ - a fixture that accidentally mirrors real-world coincidences (two
temperatures matching) creates exactly the kind of ambiguous test failure the tests are
otherwise designed to avoid.

**Corrections requested by Fabio, after manual browser testing, on the same day:**

- The `WeekForecast` desktop-width fix (stacking high/low temperatures instead of joining them
  on one line) turned out to leave a "very tiny" horizontal scrollbar rather than fully removing
  it - caught by Fabio actually looking at it in a real browser, not by the test suite (jsdom
  doesn't compute real layout, so a few-pixel overflow like this is invisible to it either way).
  Redid the arithmetic properly this time instead of re-guessing: `.page` caps at 40rem (640px,
  padding included), leaving 592px; `.week`'s own padding plus its 1px border take another 50px,
  leaving 542px for the row - but 7 days at the old 4.5rem basis plus their gaps came to 552px,
  a ~10px shortfall that exactly matches "tiny scrollbar." Reduced the per-day basis to 3.75rem
  (468px total), which - now that temps are stacked and each day's real content is much narrower
  than either width - leaves genuine margin (74px) rather than being sized to the exact pixel
  again.
- Fabio pointed out the week-strip weather icons have no way to tell what they mean beyond
  guessing from the shape, and asked whether hovering could show the label. This was a real,
  pre-existing accessibility gap, not just a missing nicety: the icons were marked
  `aria-hidden="true"` with no accessible name anywhere nearby, unlike `CurrentWeatherCard`,
  which already shows its condition as visible text - a screen reader user got temperatures for
  each day but no indication of the actual weather. Fixed both at once rather than bolting on a
  tooltip alone: each icon is wrapped in a `<span title={day.condition.label}>` (a native browser
  tooltip on hover, using the exact label text the backend already provides - no new data or
  logic needed) with a visually-hidden text sibling carrying the same label for screen readers,
  reusing the `.srOnly` utility class already established in Stage 4. The icon itself stays
  decorative rather than trying to make an inline SVG announce its own accessible name directly,
  since plain text content is unambiguously read by every screen reader, without relying on
  ARIA-on-SVG support that's historically been inconsistent across browser/AT combinations.

## 2026-09-27 - Stage 5: city description (Wikipedia)

**Tool:** Claude Code.

Built the Wikipedia client/mapper, `GET /api/city-description`, and the frontend that consumes
it: `CityDescriptionCard`, `useCityDescription`, and their wiring into `TravelPlannerPage`.

**Verified against the real API before writing anything, not from documentation alone:** called
`en.wikipedia.org/api/rest_v1/page/summary/{title}` directly for several cases before writing
`raw-types.ts` or the mapper - Calgary (a normal page), São Paulo (to confirm the title gets
URL-encoded correctly and the `extract` is long enough to actually exercise truncation - 854
characters for New York City, versus ~255 for Calgary), a non-existent page (a real 404), and
"Mercury" (a real disambiguation page, `type: "disambiguation"`) - all captured and used as the
actual fixtures in `mapper.test.ts` rather than hand-written guesses at the shape.

**A real 403, not a documentation footnote, is what actually drove the `User-Agent` design:**
while verifying the client against the live API, a request sent with an explicitly blank
`User-Agent` header was rejected outright with a 403 - confirmed directly via curl, not assumed
from Wikimedia's policy page. That sent me to read
[Wikimedia's actual User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy),
which asks for a descriptive client name/version plus contact information identifying who's
calling the API - an email, a website, or a wiki username.

**Where Fabio's own email could have gone, and why it didn't:** the natural "contact
information" to put in that header would have been Fabio's email address, but sending a user's
personal email to a third-party service in an HTTP header, without being asked to, isn't
something to decide silently - identifying information should only go to an external service
the user explicitly asks to send it to. Rather than guess, I asked Fabio directly (a placeholder
URL with no personal information, vs. his email, vs. a generic non-identifying contact string),
and he chose the placeholder-URL option. `WIKIPEDIA_USER_AGENT`'s default
(`config/env.ts`) reflects that choice and is explicitly documented as local-dev-only, with
a comment that production should set a real contact URL.

**A type-level design decision, not just an implementation detail:** `fetchJson`'s existing
signature always resolved to `Promise<T>` or threw. The Wikipedia client needed a 404 to mean
"no article" (a normal `200 {description: null}` outcome per the project's own decision on
description failures), not an error - but the Open-Meteo client's 404 handling was correctly
left alone, since a missing weather response would mean something is actually broken. Rather
than add an optional `null` to every caller's return type (forcing the Open-Meteo call site to
handle a `null` it can never receive), `fetchJson` grew a second, opt-in overload keyed off a
literal `notFoundReturnsNull: true` flag, so the return type itself - `Promise<T | null>` vs.
`Promise<T>` - tracks which behavior a given call site asked for. Verified both branches with
dedicated tests in `http.test.ts` rather than only exercising the one the Wikipedia client uses.

**A length decided by looking at real data, not picked arbitrarily:** capping the description at
280 characters (`domain/truncate-text.ts`, cut at the nearest word boundary rather than
mid-word) came after seeing the real range of `extract` lengths across the verification calls
above (255-854 characters) - short enough to keep the card a predictable size across very
different cities, long enough that Calgary's already-short extract passes through untouched.
`truncateAtWordBoundary`'s test cases (unchanged under the limit, cut exactly at the limit, a
genuine word-boundary cut, and a no-space-found fallback) were checked against expected outputs
computed with a throwaway `node -e` one-liner rather than hand-counted, since an off-by-one in a
hand-counted expected string would be indistinguishable from a real bug in the function.

**Split endpoints, continued from Stage 4's design, not revisited from scratch:** `useCityDescription`
mirrors `useCityData` almost exactly - its own `AbortController`-based stale-response guard, its
own independent loading/error state, fetched in parallel with weather rather than after it. This
was a deliberate continuation of the project's existing split-endpoints trade-off (documented in
the README): a Wikipedia outage shouldn't block the weather cards from rendering, and vice
versa. `TravelPlannerPage` renders the two blocks with entirely separate loading/error branches
for exactly that reason.

**A retroactive gap found and fixed while working on Stage 5, not left for later:** while adding
the description card's "Read more on Wikipedia" attribution link (required by Wikipedia's CC
BY-SA license), I noticed Stage 4 had never added Open-Meteo's own required attribution
("Weather data by Open-Meteo.com", CC BY 4.0) despite the weather cards being fully built and
shipped. Added it alongside the Wikipedia one rather than opening a separate stage for a
one-paragraph fix - both are the same category of "external data, same licensing obligation,"
and catching a gap like this while touching related code is better than letting it sit
undiscovered.

**A test failure that was actually a missing fixture, not a regression:** after wiring
`useCityDescription` into `TravelPlannerPage`, an existing test ("shows a weather-specific error
with retry when the city list loads but weather fails") started failing - not because the new
code was wrong, but because that test only ever mocked `/api/weather` to fail, and
`/api/city-description` had no default MSW handler yet, so it failed too, producing two error
alerts where the test expected exactly one isolated weather failure. Fixed by adding a default
success handler for `/api/city-description` to `test/msw/handlers.ts` (matching the pattern
already used for `/api/cities` and `/api/weather`), which is also the correct long-term
behavior: tests that care specifically about weather failing shouldn't have to also think about
the description endpoint unless they're testing that endpoint.

**A follow-up question from Fabio, verified live rather than assumed:** whether the description
feature correctly handles a city name in a non-ASCII script - initially framed around Croatian
using Cyrillic, which needed a factual correction first: Croatian is written in the Latin
alphabet with diacritics (č, ć, š, ž, đ), not Cyrillic - Cyrillic is used by Serbian, Bulgarian,
and others. That correction mattered, because the two cases behave differently and I checked
both for real rather than reasoning about them in the abstract:

- A Latin-script title with a diacritic (`Šibenik`) round-trips correctly end to end - curled
  directly against `en.wikipedia.org`'s real REST API and got back a normal 200 with the correct
  `extract`. This needs no special-casing in `clients/wikipedia/client.ts`: `encodeURIComponent()`
  percent-encodes any Unicode code point, not just ASCII, so the exact same code path already
  exercised by "São Paulo" in `mapper.test.ts` and `travel.test.ts` covers this too.
- A genuinely Cyrillic-script query string (e.g. "Нови Сад") returns a real 404 from
  `en.wikipedia.org` - but that's a fact about Wikipedia's content, not a bug in this app:
  English Wikipedia's own article titles are always the Latin-transliterated form ("Novi Sad"),
  confirmed by curling that exact title and getting a normal 200 back. Since `wikipediaTitle` in
  the catalogue is always the hand-curated canonical title (the same pattern already used for
  every city), this was never reachable as a real bug - the catalogue would store "Novi Sad",
  never the Cyrillic form.

Added `Šibenik` (Croatia) to `domain/city-catalogue.ts` as a real, live-verified example of a
diacritic city name flowing through the whole pipeline, with a code comment pointing back to
this entry. `city-catalogue.test.ts`'s existing generic assertions (unique id, valid coordinate
range, non-empty name/countryCode/wikipediaTitle) cover it automatically - no new test needed
there, since nothing about those checks is script-specific.

**Corrections requested by Fabio:** none this stage - the Croatia/Cyrillic mix-up above was in
Fabio's own framing of the question, and pointing it out rather than silently going along with
an incorrect premise was the right call before writing any code on top of it. The
User-Agent/contact-info decision earlier in this stage was likewise resolved via a direct
question rather than a guess Fabio had to catch after the fact.

## 2026-09-27 - Stage 6: IP geolocation

**Tool:** Claude Code.

Built `domain/client-ip.ts`, `domain/normalize-city-name.ts`, `clients/ip-geolocation/`,
`services/location.service.ts`, `GET /api/location`, `TRUST_PROXY_HOPS`/`DEFAULT_CITY_ID`/
`IP_GEOLOCATION_BASE_URL` env vars, `app.set("trust proxy", ...)`, and the frontend's
location-driven default-city selection with a provenance notice.

**ipapi.co's free tier turned out to be genuinely, currently exhausted - not a sandbox
artifact.** Before writing the client, I tried to verify a real successful response the same way
every other upstream in this project has been verified (curl first, write the mapper from the
actual response). Every attempt came back `429 {"reason": "RateLimited", ...}` - first from this
development sandbox, which was plausible (a shared egress IP could easily be over quota from
unrelated traffic), so I asked Fabio to run the identical curl from his own machine as a second
data point. He got the exact same 429. That ruled out "sandbox-specific" and confirmed the free
tier itself is exhausted right now, for real. I flagged this explicitly rather than silently
building the mapper from memory or documentation alone (this project's whole pattern has been
"verify against the real API first"), and Fabio chose to proceed on ipapi.co's own published
schema, cross-checked against the live 429 (which matched the docs' error shape exactly),
re-verified for real once the free tier's quota resets or in the deployment stage.

**A quirk in ipapi.co's own documentation directly shaped the mapper's design, not just its
types.** Fetching ipapi.co's docs page turned up something easy to miss and important to get
right: `RateLimited` is a normal HTTP 429, but "Invalid IP Address" and "Reserved IP Address"
both come back as **HTTP 200** with an `{error: true, reason: "..."}` body. Had I assumed all
error cases were non-2xx (a reasonable but wrong assumption for most APIs), `fetchJson` would
have treated a reserved/private IP as a genuine success and handed a `{error: true, ...}` object
to code expecting `{city, country_code, ...}` - a real, silent-failure-shaped bug. Instead,
`mapper.ts` checks for the `error` field in the parsed body regardless of HTTP status, the same
"read the body, not just the status" lesson already learned from Wikipedia's disambiguation
handling in Stage 5, now generalized.

**Express's numeric `trust proxy` setting was verified with a throwaway script before being
trusted, and it corrected a wrong mental model along the way.** My first assumption was that
`trust proxy = N` trusts the _leftmost_ N entries of `X-Forwarded-For` (the ones closest to the
original client, per the RFC 7239 convention of appending each hop to the right). A small
standalone Node script - `app.set('trust proxy', N)`, a route that echoes `req.ip`, and real HTTP
requests with different `X-Forwarded-For` values - showed the opposite: `req.ip` is the entry N
positions _from the right_. Once I worked through what that actually means operationally, it's
exactly correct for this app's real deployment (one reverse proxy in front, Render's own load
balancer): with `TRUST_PROXY_HOPS=1`, Express trusts that one proxy's own observation (the
rightmost entry, genuinely appended by infrastructure Fabio controls) and ignores anything a
client prepends to the header on their own request, which is precisely the spoofing protection
this setting exists for. Encoding a wrong-but-plausible mental model into `config/env.ts`'s
comment would have been a subtle, hard-to-catch mistake; verifying first caught it before any
code shipped.

**A debugging incident worth recording honestly: a background server I thought I'd killed kept
answering requests.** While verifying the trust-proxy behavior against a real running server (not
just the unit test), I restarted it with a new `TRUST_PROXY_HOPS` value using `kill %1` between
two separate Bash tool calls - and got a result that didn't match either the earlier isolated
script or the integration test I'd just written. `lsof -i :3999` showed the _original_ process
was still bound to the port: `kill %1` had silently failed, because shell job-control state
(`%1`) doesn't carry across separate tool invocations in this environment - each one is
effectively its own subshell context. The curl request had been hitting the stale, unmodified
server the whole time. Rather than trust that a `kill` "must have worked" because it printed no
error, I force-killed the actual PID reported by `lsof`, restarted with `nohup ... & disown` so
the process would survive across tool calls, and re-verified - which then matched the isolated
script exactly (the rightmost `X-Forwarded-For` entry, spoofed leftmost ignored). Documented here
because it's a real category of mistake (trusting a background-process lifecycle action
succeeded without checking) rather than a one-off fluke.

**Diacritic-aware catalogue matching directly reuses a check from the previous stage's follow-up
question.** ipapi.co returns free-text city names that won't necessarily match this app's own
`name` field on diacritics (its docs' own example uses plain ASCII city names, and there's no
guarantee every response does). `domain/normalize-city-name.ts` strips diacritics and
lowercases before comparing - the exact same normalization the Šibenik verification from the
prior stage already established works correctly for a diacritic city name, now applied on the
matching side of the pipeline instead of just the display side.

**Every failure mode was deliberately designed to collapse to the same outcome, and the tests
assert that collapse rather than just the happy path:** a loopback IP, a thrown `UpstreamError`
(real outage/rate-limit), and a mapped `null` (reserved/invalid IP, or a "successful" response
missing a field) all produce `source: "default"` from `location.service.ts` - loopback gets its
own `"local-development"` reason since it's a different, non-failure situation (there was no
provider call to fail), but the other two intentionally share `"lookup-failed"`, because no
caller does anything different with a more specific reason. `location.service.test.ts` asserts
the loopback case specifically _doesn't_ call the injected client at all (not just that it
returns the right thing), since a test that only checked the return value could pass even if the
short-circuit were accidentally removed and the client happened to also fail.

**Frontend design carries forward the split-endpoints philosophy from weather/description, with
one difference.** Location is fetched independently and never blocks on the city list, matching
the existing pattern - but unlike weather/description (which key off the _currently selected_
city and refetch on every change), location only matters once, for the _initial_ selection. That
asymmetry is why it isn't its own `useCityData`-style hook: a hook implies "this refetches when
its inputs change," and location detection has no such input - it's a one-time decision made the
moment both the city list and the detection result are available, guarded by a `useRef` (not
state) specifically so it can never accidentally re-run and stomp a user's manual city choice
later.

**A graceful-degradation design choice, stated plainly:** if `GET /api/location` itself is
unreachable (as opposed to succeeding with a `source: "default"` fallback, which the backend
already handles), the frontend silently falls back to the first catalogue city - the exact
pre-Stage-6 behavior - with no error banner and no notice. IP-detected location is a nicety this
app is designed to survive losing entirely, not a feature whose own failure should be visible to
someone who never asked to see it.

**Corrections requested by Fabio:** none directly on the implementation this stage. The
free-tier-exhaustion check (running the same curl himself) was requested by me, as a genuine
second data point I couldn't get any other way from within this environment - not a correction,
but worth recording as an instance of a human providing ground truth the AI agent couldn't reach
on its own.

## 2026-09-27 - Stage 7: 5-day forecast date picker

**Tool:** Claude Code.

Built the `date` query param on `GET /api/weather`, `weather.service.ts`'s range validation and
`selectedDay` attachment, `ForecastDatePicker` and `SelectedDayCard`, and `TravelPlannerPage`'s
recovery logic for a date that stops being valid after a city switch.

**Fabio's own suggestion at the start of this stage matched the plan already in place, and I
said so rather than silently treating it as new scope:** he asked for the date picker to only
allow selecting today through +5 days, not just validate that server-side. That's exactly what
`<input type="date" min max>` (already the documented plan for this stage) does natively - most
browsers grey out or refuse out-of-range dates directly in their own picker UI. Worth stating
plainly rather than either claiming credit for his idea or silently implementing it without
acknowledging the overlap.

**A real Zod double-message bug, caught by actually reading the response, not just checking the
status code:** the first version of the calendar-date schema chained `.regex(...).refine(...)` -
a malformed date like `"09-27-2026"` failed _both_ checks, so the 400 response listed two
overlapping, slightly confusing messages instead of one clear one. Fixed by combining both checks
into a single `.refine()`, which also simplified the schema itself. This mirrors the project's
running lesson that a response's exact shape needs to actually be looked at, not assumed correct
because the status code was right.

**The calendar-date validation itself was verified against real edge cases before being trusted,
not assumed correct because the regex "looks right":** a bare `/^\d{4}-\d{2}-\d{2}$/` regex would
accept `"2026-02-30"` (February has no 30th). Checked with a throwaway script before writing the
integration test: `Date.UTC(2026, 1, 30)` rolls over to March 2nd, so comparing the constructed
date's own year/month/day back against the input catches this. This is exactly the same
"verify a library's actual behavior, don't assume it" discipline used for `AbortSignal.timeout()`
in Stage 4 and Express's `trust proxy` in Stage 6, applied to `Date.UTC`'s rollover behavior this
time - plus the leap-year case (`"2026-02-29"` correctly rejected, `"2024-02-29"` correctly
accepted).

**A design question worked through explicitly: why hit the network again for data already in
`week`?** Since `week` already contains all 7 days (today..+6) from the initial fetch, and the
picker's own range (today..+5) is a subset of that, the frontend _could_ find the matching day
locally with zero extra requests. Went with a real `date` query param and a real server round
trip anyway, for two reasons: it's what the project's own plan documents as the Stage 7 API
contract (`GET /api/weather?...&date=`), and - more importantly for the walkthrough - it means
the _server_, not client-side JavaScript a user could tamper with, is what actually enforces which
dates are selectable. A client-only check would be exactly the kind of thing interview question
#9 (project plan) asks about: "who enforces it?" The honest answer here is "the server does,
always," not "the UI happens to prevent it usually."

**A second, related design decision: recover from an invalid date reactively, not by predicting
it in advance.** A date valid for Calgary might not be valid for Tokyo - the allowed range is
relative to _that_ city's own local "today," not the browser's - so switching cities can silently
invalidate a previously-picked date. Rather than have the frontend try to recompute or guess at
the new city's range before it's even been fetched, `useCityData` now exposes the failed
request's error `code` (not just its message), and `TravelPlannerPage` watches specifically for
`FORECAST_DATE_OUT_OF_RANGE` to clear the date and let the hook's own effect naturally refetch
without it. This keeps the hook itself simple (still just "fetch weather for these inputs, report
what happened") while the _page_ owns the recovery policy - the same division of responsibility
already used for the location-driven initial-selection effect in Stage 6.

**Reused a hard-won Stage 4 lesson instead of re-learning it:** `SelectedDayCard`'s first draft
joined high/low temperatures on one line, the exact layout choice that caused `WeekForecast`'s
real overflow bug back in Stage 4. Caught while writing the component, before it ever ran in a
real browser, and stacked them instead - the same fix already proven correct, applied
proactively this time instead of waiting to rediscover the bug.

**A genuinely subtle timezone point, verified rather than pattern-matched from the existing
`formatWeekday`/`formatFullDate` code:** sunrise/sunset needed their own formatter, and the
instinct was to copy the existing `timeZone: "UTC"` pin - which would have been wrong here.
`localDate` strings need UTC-pinning because they're pure calendar dates with no time-of-day
component to lose. `sunrise`/`sunset`/`observedAt` are different: timezone-_less_ local
datetimes, already the city's own correct wall-clock time as written. `new Date(...)` parsing a
string with no offset treats it as local time in the runtime's own zone, and formatting with _no_
explicit `timeZone` uses that same zone - the two cancel out. Confirmed directly rather than
reasoned about in the abstract: ran the exact same parse-then-format call under `TZ=UTC`,
`TZ=Pacific/Honolulu`, and `TZ=Asia/Tokyo` and got "7:38 AM" back every time. Naively copying the
UTC pin from the date formatters would have been a real, live bug - correct-looking code that
silently shifts every sunrise/sunset time by however far the browser's zone is from UTC.

**A pre-existing test broken by a legitimate signature change, caught by actually running the
suite:** adding a third `date` parameter to `weatherService.getWeatherReport` meant the
controller now always calls it with three arguments (the third `undefined` when no date is
requested) - which broke an existing integration test's `toHaveBeenCalledWith(lat, lon)`
assertion, since a mock records the arguments it actually received, and two arguments isn't the
same call shape as three (even when the third is `undefined`). Fixed by updating the assertion to
`toHaveBeenCalledWith(lat, lon, undefined)` - a small, correct consequence of an intentional
signature change, not a hidden bug, but one that only surfaced by running the existing suite
rather than only writing new tests for new behavior.

**A test-writing mistake caught before it shipped, the same class of bug this project's tests are
otherwise designed to avoid:** the first version of `TravelPlannerPage`'s date-selection test
asserted `screen.getByText("15°C")` after picking a date - which failed with "multiple elements
found," because the same day's temperature is _also_ visible in the still-rendered week strip,
not just the new selected-day card. Scoped the query with `within(selectedDayCard)` instead of
loosening the assertion - the ambiguous-fixture lesson from Stage 4's `feelsLike`/`temperature`
test bug, recognized and avoided directly this time rather than rediscovered from scratch.

**Corrections requested by Fabio:** none this stage beyond the shared suggestion noted above,
which matched the existing plan rather than changing it.

## 2026-09-27 - Refresh tokens (Stage 8): dropped for time

**Tool:** none — a scope decision Fabio made directly, not an AI-assisted task.

With the milestone gate (Stages 0-7) complete, tested, and polished, Fabio decided to drop the
conditional refresh-token enhancement (made conditional back in the
["Final simplification pass"](#2026-09-25---final-simplification-pass-before-stage-2) entry
above) rather than build it: "Let's drop refresh tokens - I won't have time to do it. We can add
it to the list of improvements." No code exists for it and none was written; the 15-minute
default access-token TTL was raised to 60 minutes in production instead, as the accepted
stand-in without a refresh mechanism. Documented in the README's
[Authentication](./README.md#authentication) section and, in full, under
[What I'd improve with more time](./README.md#what-id-improve-with-more-time).

## 2026-09-27 - Deployment (Vercel + Render + Neon)

**Tool:** Claude Code, for diagnosis; the actual console clicks (creating services, setting env
vars, triggering redeploys) were done by Fabio, since this session has no browser-automation
tooling.

Deployed the frontend to Vercel, the backend to Render, and PostgreSQL to Neon, all on their
default free-tier domains — Fabio was already logged into all three in his own browser. Three
real, live issues came up during setup and were diagnosed remotely (curl, response-header
inspection, grepping the actual served JS bundle) rather than guessed at: a Render build
failure, a wrong frontend API URL baked into a built bundle, and a CORS configuration that
silently rejected every origin. Per Fabio's instruction ("those were typos and don't need to be
in AI_USAGE"), the specifics live only in the README's
[Deployment architecture](./README.md#deployment-architecture) section, not duplicated here —
not every fixed mistake belongs in this log; deployment/infra typos documented in the project's
own technical documentation don't also need a disclosure entry.

Also verified for real once deployed, not just locally: `TRUST_PROXY_HOPS=1` against Render's
actual reverse proxy (`/api/location` correctly returns `reason: "lookup-failed"` for a real
external IP, not `"local-development"`, which is what a misconfigured hop count would have
produced instead).

## 2026-09-27 - Stage 9: Playwright end-to-end

**Tool:** Claude Code.

Built the `e2e/` workspace: two stub upstream servers, a global-setup script that migrates and
seeds a real test database, a Playwright config that starts the real backend and frontend dev
servers around all of it, and one happy-path spec.

**A real architectural insight, not just following the plan literally: the third stub server
turned out to be unnecessary, and I said so rather than building it anyway.** The plan calls for
stubbing "the upstreams" generically. Working through the actual request path before writing
code: Playwright's browser talks to the E2E backend over loopback, and with
`TRUST_PROXY_HOPS=0` (the correct local/CI value - no reverse proxy in this topology),
`location.service.ts`'s `isLoopback()` check returns true and short-circuits _before_ the
ipapi.co client is ever constructed or called. A geolocation stub server would sit there,
correctly built, and never receive a single request. Rather than build it anyway "to be safe" or
silently skip it without explanation, I pointed `IP_GEOLOCATION_BASE_URL` at a deliberately
unreachable `.invalid` host with nothing behind it - both fewer moving parts to maintain and,
if that loopback assumption ever quietly broke in a future stage, a loud connection-error
failure instead of a silent real-network call sneaking into an "E2E never hits live APIs" suite.

**A real, if minor, TypeScript mistake caught by the typecheck step, not by code review:** the
first draft of `e2e/fixtures.ts` defined `CALGARY`/`TOKYO` as plain object literals (`{id:
"calgary", ...}`), which TypeScript widens `id` to `string`. Using `.id` as a computed property
key when building `WEATHER_FIXTURES`/`DESCRIPTION_FIXTURES` then produced an object whose type
lost the specific `"calgary" | "tokyo"` keys, so every lookup came back typed as possibly
`undefined` under this project's `noUncheckedIndexedAccess` setting - correctly, since from the
type system's point of view a plain `string` key could be anything. Fixed with `as const` on
both city objects, which was also the more accurate type in the first place: these are fixed
fixture identities, not arbitrary strings that happen to hold "calgary" today.

**The test was verified to actually test something, using the same discipline this project has
applied to every stage's most important test:** rather than trust a green run at face value,
I deliberately corrupted a fixture value (`conditionLabel`) after the suite passed, confirmed
the run then failed with a real, readable diff between what the page showed and what the test
now (incorrectly) expected, and only then reverted it and confirmed a clean pass again. This is
the same "prove the bug it catches is real" standard already used for `useCityData`'s
stale-response test in Stage 4 and the trust-proxy behavior in Stage 6, applied here to an E2E
suite where a false-positive "it passed" is especially easy to get wrong quietly (a bad
selector, an assertion that matches too loosely, a race that happens not to manifest once).

**Reusing `TEST_DATABASE_URL` for E2E, rather than provisioning a dedicated database, was a
deliberate simplicity call, not an oversight.** CI (and a local run) executes `npm test` and
`npm run e2e` as separate, sequential steps - never concurrently against the same database - so
there's no real contention this would need to guard against, and a second database would be
infrastructure justified by a race condition that can't actually happen in how this project runs
its test suites. `global-setup.ts` truncates `users` before seeding specifically so leftover
state from whichever suite ran last never makes the E2E login step flaky, which is the actual
risk reusing the database introduces.

**Corrections requested by Fabio:** none this stage.

## 2026-09-27 - Stage 10: polish (plus three specific requests)

**Tool:** Claude Code.

Fabio asked three specific questions/changes alongside starting Stage 10: whether fetching a
user's IP needs permission/notification, sorting the city list alphabetically, and clearing the
selected forecast date on a city change. Handled those first, then did the planned
accessibility pass.

**The IP/consent question was answered as reasoned judgment, explicitly flagged as not legal
advice, rather than either refusing to engage or asserting false certainty.** The actual answer
turns on a real distinction: GDPR treats an IP address as personal data, but processing personal
data requires a _lawful basis_, not necessarily _consent_ specifically — "necessary for the
service the user is actively requesting" is a real, commonly-relied-on basis (the same one a
shopping site uses to default your currency by IP), and it's narrower here than the cases that
genuinely do need an opt-in gate (persistent tracking, third-party ad profiling): the IP is never
stored (already true, and already documented from Stage 6), used for exactly one lookup, and
directly serves the feature on screen. Transparency is still expected, though - and the app
already exceeds most sites here, since "Detected from your IP" is visible on-screen text the
moment detection succeeds, not something a user would only discover by reading a privacy policy.
No code changed as a result of this question; it was pure research delivered as reasoning with
its confidence level stated honestly, not a task with an obvious implementation.

**City sorting: `localeCompare`, verified against this project's own diacritic cities rather than
assumed correct for them.** A plain `<` comparison would put "Šibenik" after every ASCII name
(sorted by raw code point, not alphabetically); `localeCompare` was checked directly against the
full real catalogue (including "São Paulo" and "Šibenik") before being trusted, producing "Paris,
São Paulo, Šibenik, Sydney" - correctly interleaved, not clustered at the end. The sort lives in
`listCities()`, not by reordering `CITY_CATALOGUE`'s own declaration - nothing else in the file
depends on that array's order, so there was no reason to disturb it for a display concern.

**Date-clearing on city change: proactive, not just the existing reactive recovery - a real
design distinction, not a rename.** Stage 7 already recovered from a stale date via the
`FORECAST_DATE_OUT_OF_RANGE` error code, but only _after_ sending a request with the old date and
having the server reject it. Fabio's ask was for the date to clear immediately on a city switch,
before any such request goes out at all - a different, additive behavior, not a replacement:
`handleCityChange` now clears `selectedDate` directly, and the Stage 7 reactive effect stays in
place for the one case it still uniquely covers (the same city's allowed range shifting from time
passing, with no city change involved). Documented both mechanisms and which gap each one closes,
rather than describing the reactive effect the same way after its primary original justification
had moved elsewhere.

**A real stale-DOM-reference test bug, caught by the tests actually failing, not predicted in
advance.** The two rewritten `TravelPlannerPage` tests first captured the date-picker input
element once, before triggering a city switch, and reused that reference afterward - which failed
because the weather section (input included) unmounts entirely during the loading skeleton
between one city's data and the next, so the captured reference pointed at a detached node no
longer reflecting new state. Fixed by re-querying via `screen.getByLabelText(...)` fresh inside
each `waitFor`, the same pattern already used correctly elsewhere in this file - a reminder that
"I've already got a reference to it" doesn't hold across a component-unmount boundary in React,
even when the visible UI looks like the same element is still there.

**Two real, computed (not eyeballed) WCAG contrast failures, found by actually running the
numbers.** Before touching any component, I computed relative-luminance contrast ratios for
every color-token pair in `tokens.css` using the real WCAG formula, in both light and dark mode -
not by looking at the hex values and guessing. Two failed outright in dark mode:
`--color-primary` on `--color-surface` (2.83:1, needs 4.5:1 for text) and `--color-notice` on
`--color-notice-bg` (2.63:1). Fixing the first one properly required noticing a real conflict,
not just picking a lighter blue: `--color-primary` is _also_ a button background, and the
lightened blue that fixes text-on-dark-surface contrast (`#60a5fa`, 5.75:1) drops white-button-
text contrast to 2.54:1 - actively making the button worse while fixing the link/icon case.
Verified this trade-off numerically before deciding, rather than fixing one regression by
introducing another: split into two tokens, `--color-primary` (button backgrounds, unchanged,
already passes in both themes) and a new `--color-primary-text` (links/icons/focus outlines,
adaptive per theme - `#2563eb` light, `#60a5fa` dark). `--color-notice`'s dark value became
`#fbbf24` (7.91:1), no second token needed since it only ever appears as text, not a background.

**A concrete, previously-missing heading, found by actually grepping for headings across the
whole frontend, not assumed present.** `LoginPage` has an `<h1>`; the authenticated view's
`AppHeader` had only a `<span>` styled to look the same - meaning a screen-reader user navigating
by heading level had literally nothing to land on once logged in. Fixed by making it a real
`<h1>`, with an explicit `margin: 0; font-size: 1rem;` reset, since there's no project-wide
heading-style reset for it to fall back on (confirmed by reading `global.css`, not assumed).

**Focus order, the third accessibility-pass item from the project plan, addressed with a real,
regression-tested fix rather than left as a checklist line.** The login → authenticated-view
transition left focus on nothing in particular, since the "Sign in" button holding it is
unmounted the moment `App.tsx` swaps views. `AppHeader` now moves focus to its own `<h1>` on
mount (`tabIndex={-1}`, focusable programmatically without joining the Tab order) - standard SPA
view-transition guidance. Verified with the same discipline as this project's other important
tests: added a `toHaveFocus()` assertion, then deliberately commented out the `.focus()` call to
confirm the test actually failed with the change reverted out, before restoring it and confirming
a clean pass.

**Corrections requested by Fabio:** none directly on implementation. The three requests that
opened this stage (IP question, city sort, date-clear) were new asks, not corrections to
anything already built.

## 2026-09-27 - Pre-submission review: code smells, test reuse, coverage, requirements

**Tool:** Claude Code.

Before submitting, Fabio asked for four things: a code-smell review, a test-reuse review
(repeated emails/passwords/URLs that should be shared constants), a coverage check, and a
cross-check against the assignment PDF for anything missing. Findings, verified rather than
assumed, and each fixed:

**A real, previously untested failure path in `fetchJson`, caught by writing the failing test
first.** A 2xx response whose body isn't valid JSON (an HTML error page from a misconfigured
proxy, an empty body) made `response.json()` throw an uncaught `SyntaxError`, which the central
error handler would map to a generic 500 — inconsistent with every other upstream failure in
that file, which maps to a structured 502. Added the test, confirmed it failed against the
existing code (a real `SyntaxError`, not the expected `UpstreamError`), then wrapped the parse
in a `try/catch` and confirmed the same test now passes.

**A real coverage-scope blind spot, not just a low number.** The API's `vitest.config.ts`
`coverage.include` list predated the three upstream clients (`open-meteo/client.ts`,
`wikipedia/client.ts`, `ip-geolocation/client.ts`) and never included them — so the reported
97%+ number was accurate for what it measured but silently excluded three files with zero test
coverage: URL construction, query parameters, required headers, encoding. Added a
`client.test.ts` next to each (stubbing `fetch` directly, the same style as the rest of the
backend's unit tests), then widened `coverage.include` to all of `src/`, excluding only genuinely
untestable files (`server.ts`, `db/pool.ts`, type-only `types/**` and `**/raw-types.ts`). The
resulting number — 97.99% statements, 92.18% branches, 100% functions, 98.34% lines — is now an
honest measurement of real logic, not a number narrowed to look complete.

**Duplicated test fixtures, consolidated rather than left to drift.** Several literals were
independently reinvented across files: `"http://localhost:3000"` in five web test files, four
near-identical weather-report builders (`reportWith`, three separate `makeReport`s), a duplicated
`fakeTokenService()` in two API test files, a JWT-secret literal defined separately in two
places, and the E2E suite's four stub/dev-server ports hard-coded in both `playwright.config.ts`
and `stub-servers.ts` with no shared source of truth. Consolidated into `apps/api/test/helpers/
fixtures.ts` (+ `createFakeTokenService` in the existing `fakes.ts`), `apps/web/src/test/
fixtures.ts` (with `msw/handlers.ts` now holding only handlers, built from those fixtures), and
`e2e/fixtures.ts`'s new `PORTS` export. Verified nothing's behavior changed by re-running every
affected suite before and after — same pass/fail counts throughout.

**Two moderate refactors, done rather than just flagged, with behavior verified unchanged.**
`useCityData` and `useCityDescription` had independently implemented the same ~40-line
abort/loading/error/retry state machine; extracted a shared `lib/useAbortableRequest.ts` and
made both thin wrappers over it. And the backend's `WeatherReport`/`CityDescription` DTOs lived
in the service files that also imported the clients that produced them, creating a two-way
import between a client and its service (worked around, before this, with a duplicated inline
type in `description.service.ts`); moved both into `src/types/`, which both a client and its
service now import independently. In both cases, the existing test suites — written against the
public shape, not the internal implementation — needed no changes and still passed unmodified,
which is the intended evidence that behavior didn't change, only where the logic lives.

**Stale comments and narrative "Stage N" references, rewritten into present-tense documentation**
across `apps/`, `e2e/`, and `.github/workflows/ci.yml` — this review's own de-staging pass turned
the README from a stage-by-stage build log (appropriate while the project was in progress) into
documentation for a finished submission, per Fabio's request. In the process, found and fixed two
inconsistencies between `AI_USAGE.md` and the README it's meant to summarize: this file's Stage 9
and Stage 10 entries were dated `2026-09-28`, a day after both stages' actual commits
(`2026-09-27`, confirmed against `git log`); and there was no entry at all documenting the
decision to drop Stage 8 (refresh tokens) or the deployment stage — both added above, in their
correct chronological place.

**Requirements check against the assignment PDF:** every functional requirement is met. The
gaps were in the deliverables: the README's "Known limitations" section (explicitly required by
the assignment) and "Trade-offs" section were still `_Coming in Stage 11_` placeholders, along
with a "work in progress" banner at the top — all written for real as part of this pass.
Also added `.env.example` files for both apps (variables existed and were documented in the
README, but there was no copyable template) and a `npm run build` step in CI, which would have
caught the real Render build failure (documented in the README's deployment section) before a
live deploy did, had it existed at the time.

**Corrections requested by Fabio:** to keep this log itself consistent with the README it
summarizes, this file got the same review treatment as the README, rather than only having one
new entry appended on top of older, unreviewed ones.

## 2026-09-27 - Codex review response: IP provider switch, real edge-case fixes, and three corrections to my own initial assessment

**Tool:** Claude Code, responding to a separate OpenAI Codex review Fabio requested. Codex wrote
up its findings in a local working document; my own item-by-item assessment of that review (what
to implement, what to only document, what to skip, and why) was written up the same way. Neither
document is committed to this repository — both were local, working artifacts for this pass, not
submission deliverables — so this entry is the durable record of that review instead.

**Every claim in Codex's report was independently reproduced before being trusted, not accepted
on the report's word alone:** `z.coerce.number()` turning `""`/`"  "` into `0`, confirmed with a
throwaway Zod script; `formatLocalTime`'s DST-gap bug, confirmed by running the actual function
under `TZ=America/Edmonton` (this environment's own default zone, as it happens) and getting
"3:30 AM" for a string that says "02:30"; `errorHandler` mapping `express.json()`'s own errors to
a 500, confirmed with a real Express app and a real malformed-JSON request; and, most
importantly, ipapi.co's pricing page stating its free tier is _"not meant for use in production
or deployments"_ — confirmed by fetching the page directly — combined with a fresh `curl` to the
live API returning a real `429` that same day. That last one meant the deployed app had likely
never successfully detected a real visitor's location at all, not just occasionally hit a quota.

**Three corrections Fabio made to an earlier draft of my own assessment, before any code was
written, recorded honestly rather than smoothed over:**

1. **The timeout fix I'd planned (`err.name === "TimeoutError"` in `response.json()`'s catch)
   was too narrow.** I'd verified it worked on this runtime with a real stalled-body repro, but
   Fabio pointed out the rejection's exact shape isn't spec-guaranteed for every engine/consumer.
   Fixed by checking the shared `AbortSignal`'s own state (guaranteed by spec once it fires)
   instead, with the error's own shape kept as a fallback specifically so existing tests that
   stub `fetch()` directly — never touching the real signal — still pass. Implementing this
   exposed a real regression of my own: the signal-only version broke an existing test
   ("throws a 504 UpstreamError when the request times out"), caught immediately by running the
   suite, not discovered later.
2. **"Trim the coordinate string" wasn't the actual fix.** `""` still coerces to `0` after
   trimming — the fix needed to explicitly reject the empty string (and, once actually testing
   edge cases, "0x10" and "1e1", which `Number()` also happily parses as 16 and 10). Landed on a
   `.trim().regex(/^-?\d+(\.\d+)?$/)` check before any numeric conversion at all.
3. **`lookup-failed` from the deployed app does not prove `TRUST_PROXY_HOPS` is configured
   correctly**, and an earlier version of this assessment (and the README) claimed it did. A
   too-low hop count resolves `req.ip` to Render's own private proxy address instead of the real
   visitor's — not loopback, so it doesn't short-circuit into `"local-development"`, but still a
   reserved address the provider correctly rejects, landing on the exact same `"lookup-failed"`
   reason a correct-hop-count-but-provider-failure would. The single observation we'd made
   couldn't tell those two apart. Replaced with a real distinguishing check (a request with a
   spoofed `X-Forwarded-For` header should return the real visitor's city, not the spoofed
   address's) — see the README's deployment-architecture section, and `config/env.ts`'s
   `TRUST_PROXY_HOPS` comment, both corrected to state this honestly instead of overclaiming.

**A real Zod v4 typing quirk, found while implementing the coordinate fix, not assumed away:**
`z.string().pipe(z.coerce.number()...)` fails to typecheck — `z.coerce.number()`'s declared input
type (`unknown`) doesn't satisfy what `.pipe()` expects from the previous schema's string output,
even though the runtime behavior would be correct. Worked around with `.transform(Number)` before
`.pipe(z.number()...)` instead, which typechecks cleanly and, since the regex already guarantees
a plain decimal string by that point, is exactly as safe as the coerce version would have been.

**A real mistake in my own earlier fix, caught immediately by re-running the suite:** inserting
the new `isTimeoutAbort` helper between `fetchJson`'s two overload signatures and its
implementation broke TypeScript's overload grouping (`Function implementation name must be
'fetchJson'`) — overload declarations and their implementation have to stay contiguous. Moved the
helper above the overloads instead.

**Every fix here was verified with a failing test first**, the same discipline used throughout
this project: the new stalled-body test, coordinate-validation tests, malformed-JSON/oversized-
body tests, and the DST regression test were each confirmed to fail against the pre-fix code
(via `git stash` on just the relevant file) before being confirmed to pass against the fix,
rather than trusting a green run alone to mean the test was actually exercising anything. The
DST test in particular didn't need any environment manipulation to prove this, since this
sandbox's own default timezone already happens to be `America/Edmonton` — the exact zone the bug
was reported in.

**The IP provider switch (ipapi.co → ipwho.is)** touched only `clients/ip-geolocation/` (client,
raw types, mapper, and their tests) and one env default, by design — the vendor-isolation
architecture (see the README's Architecture overview) meant `location.service.ts` and its own
tests needed zero changes. Verified against the real live API before trusting it, the same
standard as every other upstream integration in this project: a real successful lookup (8.8.8.8
→ San Jose) and a real reserved-range rejection (10.0.0.1 → `{success: false, ...}`) through the
actual client code, not just the mapper in isolation.

**What I chose not to implement, and why:** the static city list and the same-name/same-country
matching limitation (both flagged by Codex) are documented rather than "fixed" — see the
README's [Trade-offs](./README.md#trade-offs) and [Known limitations](./README.md#known-limitations)
sections. The alternatives considered for each would have added real infrastructure — a
geocoding dependency, an arbitrary distance threshold — to satisfy a stricter reading of one
requirement without solving a problem this app actually has.

## 2026-09-28 - Forecast-date picker: stop re-fetching the whole report on a date pick

**Tool:** Claude Code. Fabio's request, from reviewing the code and actually using the deployed
app, not from an AI-initiated finding: picking a forecast date visibly reloaded the
current-conditions and week-strip cards too, not just the selected-day card he'd just asked for,
and he asked whether that reload was actually necessary.

**Root cause, confirmed before touching anything:** `weather.service.ts`'s `getWeatherReport`
always called `openMeteoClient.getForecast(latitude, longitude)` fresh regardless of `date` -
the Open-Meteo request itself never depended on it - then did nothing more than
`report.week.find((day) => day.date === date)` to pick `selectedDay` out of the _same_ 7-day
`week` array the response already carried. The frontend's `useCityData` folded `date` into its
request key anyway, so every date pick re-ran the whole fetch-and-render cycle for data that
hadn't changed. Confirmed by inspection of both files (not assumed): nothing in the Open-Meteo
client's request-building code (`clients/open-meteo/client.ts`) reads `date` at all.

**The fix:** `selectedDay` was always derivable client-side from data the frontend already had
as soon as the first (dateless) request resolved, so it now is - `weather.week.find((day) =>
day.date === selectedDate)` in `TravelPlannerPage`, bounded by `weather.allowedForecastDates` so
`week`'s 7th day (today+6 - reachable data that was never a selectable date, a deliberate
narrower-picker-range rule from Stage 7) can't be matched even though it's technically present
in the array. This let a real amount of code come out rather than just move: the `date` query
param and its Zod schema (`controllers/travel.controller.ts`), `ForecastDateOutOfRangeError`
(`errors/app-error.ts`), and the validation branch in `weather.service.ts` (now a
`description.service.ts`-style thin pass-through) are all gone, along with `selectedDay` from the
`WeatherReport` type on both sides. The one thing that had to move rather than disappear: nothing
stops a user from typing a date straight into the native `<input type="date">` that falls outside
`allowedForecastDates` (most browsers only grey out/refuse that in their own picker UI, not a
hand-typed value) - previously the server's `ForecastDateOutOfRangeError` caught this and
`TravelPlannerPage` cleared the date in response; now `TravelPlannerPage` checks the same range
itself and clears the date the moment it notices, no request involved.

**Verified for real, not just by the test suite passing:**

- Ran the actual E2E suite (`npm run e2e`) against the real backend, a real Chromium browser, and
  the existing Open-Meteo/Wikipedia stubs - the happy-path spec still picks a forecast date and
  asserts the selected-day card shows that day's real (stubbed-upstream, real-mapper) data, now
  purely as a client-side match rather than a second round trip. Passed on the first run after
  the change, and the spec's own comment was corrected so it no longer claims a "request/response
  round trip" that no longer happens.
- Added a request-counter assertion to `TravelPlannerPage.test.tsx`'s date-picking test
  (`weatherRequestCount`) proving a date pick makes zero additional `/api/weather` calls - this is
  the actual regression test for the bug Fabio reported, not just a happy-path check that the
  right data renders.
- Added a new test for the hand-typed-out-of-range case (typing a date one day past
  `allowedForecastDates.max`) asserting the picker clears back to empty, no alert appears, and -
  again via the request counter - no network request was made just to find that out.
- Ran the full suite after the change: 168/168 API tests, 84/84 web tests (net -4 from before -
  three tests covering the now-deleted server-side date-range-error path were removed rather than
  adapted, since that path no longer exists, and two near-duplicate `errorCode` tests in
  `useCityData.test.ts` were consolidated into the tests they duplicated), `npm run typecheck`
  clean, `npm run lint` clean. Coverage stayed above both workspaces' enforced floors: API
  98.38%/92.48%/100%/98.75% (was 98.11%/92.46%/100%/98.43%), web 97.4%/92.99%/96.2%/98.57% (was
  97.4%/92.94%/96.15%/98.57%) - both moved slightly up, not down, despite removing code, since the
  removed lines were exactly the ones the deleted tests existed to cover.

**What I didn't change:** the today-to-today+5 picker range being one day narrower than the
7-day `week` (Stage 7's deliberate rule, restated in the README's
[Timezone / date handling](./README.md#timezone-date-handling) section) is preserved exactly,
just enforced in one fewer place. `allowedForecastDates` itself still comes from Open-Meteo via
the mapper, untouched by this change.

## 2026-09-28 - Production bug: IP geolocation never worked, because TRUST_PROXY_HOPS was wrong

**Tool:** Claude Code, diagnosing a real bug Fabio reported after deploying and testing the app
for the first time: both his Mac (browser) and his phone showed "Couldn't detect your location,
showing Calgary" — the `reason: "lookup-failed"` fallback, not the `"local-development"` one, so
this wasn't the loopback short-circuit; detection was genuinely failing in production, for every
real visitor, regardless of which real IP they connected from.

**Why this wasn't caught earlier:** the Codex-review pass on 2026-09-27 already corrected an
overclaim that a `lookup-failed` response from the deployed app "proved" `TRUST_PROXY_HOPS` was
configured correctly, and explicitly listed the real verification (a spoofed-`X-Forwarded-For`
check against the live deployment) as something only Fabio could run after redeploying — see that
date's entry. That check was never run before this session, so the wrong assumption
(`TRUST_PROXY_HOPS=1`, "Render sits exactly one reverse proxy in front of this app") had never
actually been tested against reality; it had only ever been tested against a local Express server
built to match that same assumption, which of course confirmed it.

**First, a real check on a claim I almost trusted uncritically:** searching for Render's real
proxy topology surfaced a set of GitHub search results that looked wrong on their face — several
small, otherwise-unrelated repositories with nearly identical PR titles ("trust Render's three
proxy hops") and descriptions. That pattern (many unrelated repos independently arriving at
identical, oddly specific phrasing for a niche fact) reads as search-result pollution rather than
organic knowledge, so it was treated as unverified rather than cited as a source, even though the
number it named ("3") later turned out to be correct. A more credible-looking source (a Render
team member's own community-forum comment, via a redirected URL) was checked next and said
something that actually contradicts the standard X-Forwarded-For hop-counting model this app's
`TRUST_PROXY_HOPS` design assumes ("we set the first IP in the list to the real client IP") —
which made it clear the public information available was either incomplete or describing a
different mechanism than expected, not something to build a fix on by more searching.

**The actual diagnostic, against the real deployment:** rather than guess a new hop count and
have Fabio redeploy repeatedly to trial-and-error it, I added a small temporary block to
`/api/location`'s own JSON response — the raw `X-Forwarded-For` header and what Express currently
resolved `req.ip` to (`controllers/travel.controller.ts`, with a matching test asserting its
shape). This is different from server-side logging: the data went back only to the requester, in
their own response body, never written to a log or persisted anywhere, so it didn't conflict with
the documented policy (README's [Security considerations](./README.md#security-considerations))
of never logging a visitor's IP — I flagged this distinction to Fabio before adding it, since the
policy is a deliberate, stated design commitment, not something to quietly work around.

One real request from Fabio's own Mac (incognito Chrome, so no client-set headers) returned:

```json
"_debug": {
  "rawForwardedFor": "70.65.124.163, 162.159.102.35, 10.192.34.107",
  "resolvedIp": "10.192.34.107",
  "nearestSocketPeer": "::1"
}
```

Three real entries, not one: `70.65.124.163` (Fabio's own visible IP, added by Cloudflare since a
normal browser never sets this header itself), `162.159.102.35` (Cloudflare's own edge IP —
`162.159.0.0/16` is a documented Cloudflare range), and `10.192.34.107` (a private RFC1918
address — Render's own internal load balancer). With `TRUST_PROXY_HOPS=1`, Express was resolving
`req.ip` to the _last_ of these — Render's own internal address — which ipwho.is correctly
rejected as a reserved/private range, landing on `lookup-failed` for every single request
regardless of who was actually connecting. `nearestSocketPeer: "::1"` (loopback) is expected and
uninformative on its own — Render proxies to the running container over localhost — and doesn't
interact with `location.service.ts`'s `isLoopback()` check, since that only ever runs against the
_resolved_ `req.ip`, never the raw socket peer.

**The fix:** `TRUST_PROXY_HOPS=3`, set directly in Render's dashboard (an env var, not a code
change) — Express's numeric `trust proxy` counts hops from the right, and three trusted hops
(visitor → Cloudflare edge → Render's own load balancer) correctly lands back on the first entry,
the visitor's own IP, regardless of anything a client might prepend to a spoofed header. Verified
against the real chain, not just reasoned about: a unit test in `test/travel.test.ts` was updated
to use `trustProxyHops: 3` against the exact real header shape observed
(`"9.9.9.9, 70.65.124.163, 162.159.102.35, 10.192.34.107"`, with `9.9.9.9` standing in for a
client-spoofed prefix) and asserts the location service receives `70.65.124.163`, not the
spoofed value and not Render's own internal address.

**Cleaned up after confirming:** the temporary `_debug` block and its test were removed once the
real chain shape was known (they were never meant to ship — added, used once, then reverted in
the same session), and every place documenting the wrong assumption was corrected rather than
silently edited: `config/env.ts`'s `TRUST_PROXY_HOPS` comment, the README's
[Deployment architecture](./README.md#deployment-architecture) and
[IP-based geolocation](./README.md#ip-based-geolocation) sections, and the environment-variables
table — each now states the real number and, for the two sections that previously asserted the
wrong one outright, explains what was wrong and how it was actually found, the same "record the
mistake, don't quietly fix it" standard used throughout this log. `apps/api/.env.example` and the
local-dev default (`0`) were deliberately left alone — this only ever affected the deployed
value, since local dev genuinely has no reverse proxy in front of it.

**A note on process, not just the bug:** this fix was applied twice. The first pass was lost when
an in-progress `git reset` (meant to be a `--soft` reset ahead of a planned force-push) left the
working tree clean instead of staged — soft resets never touch the working tree or index by
themselves, so something else in that sequence must have discarded the changes too. Caught by
checking actual file contents after the fact rather than trusting `git status`/the reflog alone
("nothing to commit, working tree clean" looked fine on its own, but contradicted what should
have been true right after a soft reset), and redone from scratch immediately once confirmed
missing, using this entry (already written before the loss) as the spec for exactly what to
reproduce.

**Still needs Fabio:** set `TRUST_PROXY_HOPS=3` in Render's dashboard and redeploy, then run the
two-check verification this session's earlier work already documented — a normal request
returning the real city with `source: "ip"`, and the same request with a spoofed
`X-Forwarded-For` header still returning the real city, not the spoofed address's — to confirm
the fix against the live deployment rather than trusting the local regression test alone.
