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
