# AI usage log

This is a running log of how AI tools were used while building this project, kept during
development rather than reconstructed afterward, per the assignment's AI use policy. It's
summarized in the [README](./README.md#ai-usage) once the project is feature-complete.

For every entry: I (Fabio) reviewed the output to understand it, and made final decisions. Where I changed or rejected something AI proposed, that's noted
explicitly - those are usually the more interesting parts of this log.

## Tools used

- **Claude Code** - primary assistant for planning, scaffolding, implementation,
  and code review throughout this project.
- **ChatGPT** - used ad hoc for secondary review of specific decisions where noted.

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
