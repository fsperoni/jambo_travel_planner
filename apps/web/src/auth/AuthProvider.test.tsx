import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { apiFetch } from "../api/http";
import { server } from "../test/msw/server";
import { VALID_CREDENTIALS } from "../test/msw/handlers";
import { useAuth } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";

// AuthProvider has no UI of its own, so its behaviour is exercised through
// a small harness component that renders its state as plain text/testids
// and wires buttons to its actions — closer to how a real consumer
// (LoginPage, AppHeader) would use it than testing the context internals
// directly.
function AuthHarness() {
  const { user, isAuthenticated, isSessionExpired, login, logout } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  return (
    <div>
      <p data-testid="authenticated">{String(isAuthenticated)}</p>
      <p data-testid="session-expired">{String(isSessionExpired)}</p>
      <p data-testid="user-email">{user?.email ?? "(none)"}</p>
      {loginError && <p data-testid="login-error">{loginError}</p>}

      <button
        onClick={() => {
          setLoginError(null);
          login(VALID_CREDENTIALS.email, VALID_CREDENTIALS.password).catch((err: unknown) => {
            setLoginError(err instanceof Error ? err.message : "unknown error");
          });
        }}
      >
        Log in with valid credentials
      </button>
      <button
        onClick={() => {
          setLoginError(null);
          login("wrong@example.com", "wrong-password").catch((err: unknown) => {
            setLoginError(err instanceof Error ? err.message : "unknown error");
          });
        }}
      >
        Log in with wrong credentials
      </button>
      <button onClick={logout}>Log out</button>
      <button onClick={() => void apiFetch("/protected").catch(() => {})}>
        Call a protected endpoint
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <AuthProvider>
      <AuthHarness />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  it("starts unauthenticated, with no user and no expired-session flag", () => {
    renderHarness();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("session-expired")).toHaveTextContent("false");
    expect(screen.getByTestId("user-email")).toHaveTextContent("(none)");
  });

  it("becomes authenticated with the logged-in user's email after a successful login", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Log in with valid credentials" }));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("user-email")).toHaveTextContent(VALID_CREDENTIALS.email);
  });

  it("stays unauthenticated and surfaces the error when login fails", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Log in with wrong credentials" }));

    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toHaveTextContent("Invalid email or password");
    });
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("returns to unauthenticated after logout", async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "Log in with valid credentials" }));
    await waitFor(() => expect(screen.getByTestId("authenticated")).toHaveTextContent("true"));

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-email")).toHaveTextContent("(none)");
  });

  it("clears the session and flags it as expired when a protected call comes back 401", async () => {
    server.use(
      http.get("http://localhost:3000/protected", () =>
        HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole("button", { name: "Log in with valid credentials" }));
    await waitFor(() => expect(screen.getByTestId("authenticated")).toHaveTextContent("true"));

    await user.click(screen.getByRole("button", { name: "Call a protected endpoint" }));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("session-expired")).toHaveTextContent("true");
  });
});
