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
