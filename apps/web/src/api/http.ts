// Falls back to the API's default local dev port so `npm run dev` works
// with zero required setup; the real deployed URL is provided via
// VITE_API_BASE_URL at build time (see the README's environment-variables
// section) once the app is actually deployed. Exported so tests and other
// modules that need to know it (e.g. MSW handlers) share this one
// definition instead of re-declaring the literal.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

// Shown whenever a failure isn't an ApiError (a network error, a thrown
// non-Error value) — i.e. there's no server-provided message to show
// instead. Exported so every call site uses the exact same wording rather
// than each re-typing its own copy that could quietly drift out of sync.
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** Mirrors the backend's `{ error: { code, message, details? } }` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The message a UI should show for a caught failure: an ApiError's own
 *  message when there is one (the server's own explanation), or the
 *  generic fallback otherwise. */
export function toErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : GENERIC_ERROR_MESSAGE;
}

interface AuthHandlers {
  getAccessToken(): string | null;
  onUnauthorized(): void;
}

// http.ts can't import AuthProvider directly (AuthProvider imports the
// auth.api.ts functions that call apiFetch, which would make the module
// graph circular), and every call site re-passing the current token
// manually would be easy to forget on a new endpoint. Instead AuthProvider
// registers itself once, on mount, with a getter (always reads the latest
// token) and a callback (fires when the server rejects that token) — a
// small, explicit alternative to reaching for a state-management library
// just to solve this one wiring problem.
let authHandlers: AuthHandlers = {
  getAccessToken: () => null,
  onUnauthorized: () => {},
};

export function configureAuthHandlers(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

/**
 * A thin fetch wrapper: resolves the URL against the API base, attaches a
 * Bearer token when one is available, and turns a non-2xx JSON error
 * envelope into a typed `ApiError` instead of making every caller parse
 * the response body itself.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authHandlers.getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && token) {
    // A token was attached and the server rejected it — the session is no
    // longer valid (expired, most likely). A 401 with *no* token attached
    // (e.g. a wrong-password login attempt) is a normal error for the
    // caller to handle instead — see auth.api.ts / LoginPage.tsx — not a
    // session-expiry event, so it deliberately doesn't trigger this.
    authHandlers.onUnauthorized();
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = (
      body as { error?: { code?: string; message?: string; details?: unknown } } | null
    )?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN_ERROR",
      error?.message ?? GENERIC_ERROR_MESSAGE,
      error?.details,
    );
  }

  return response.json() as Promise<T>;
}
