// Extends Vitest's `expect` with jsdom-aware matchers (toBeInTheDocument, etc.)
// used across React Testing Library tests.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// React Testing Library normally registers its own afterEach(cleanup)
// automatically — but only if it finds a *global* `afterEach` function.
// This project deliberately doesn't enable Vitest's `globals: true` (explicit
// imports over magic globals, everywhere), so that auto-detection never
// fires and unmounted-component DOM trees would otherwise pile up in
// `document.body` across tests within the same file. Registering it
// explicitly here is the direct consequence of that choice, not a
// workaround for a bug.
afterEach(() => cleanup());

// Starts the MSW server once for the whole test run, resets any per-test
// handler overrides (server.use(...)) after each test so they don't leak
// into the next one, and shuts it down when the run finishes.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
