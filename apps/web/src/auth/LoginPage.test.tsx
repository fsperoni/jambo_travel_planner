import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";

// Mocked rather than rendered through a real AuthProvider: this file tests
// LoginPage's own rendering logic (form, pending state, error display) in
// isolation, given whatever useAuth() returns. The full login flow through
// a real AuthProvider is covered by App.test.tsx instead.
vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockUseAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}): void {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    isAuthenticated: false,
    isSessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    mockUseAuth();
    render(<LoginPage />);

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a session-expired notice when isSessionExpired is true", () => {
    mockUseAuth({ isSessionExpired: true });
    render(<LoginPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session expired. Please sign in again.",
    );
  });

  it("shows a pending state while the login request is in flight, then clears it", async () => {
    let resolveLogin!: () => void;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    mockUseAuth({ login });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();

    resolveLogin();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });
  });

  it("shows the ApiError's message when login rejects with one", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Invalid email or password"));
    mockUseAuth({ login });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("shows a generic message when login rejects with something other than an ApiError", async () => {
    const login = vi.fn().mockRejectedValue(new Error("network down"));
    mockUseAuth({ login });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
