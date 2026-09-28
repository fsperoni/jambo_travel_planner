import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { renderWithProviders } from "./test/render-with-providers";
import { VALID_CREDENTIALS } from "./test/fixtures";

// An integration-style test of the whole auth wiring: AuthProvider,
// http.ts, LoginPage, and App's own "which view to show" logic, exercised
// together through a real (MSW-mocked) login rather than by asserting on
// AuthProvider's internal state directly. The individual pieces have their
// own focused unit tests elsewhere (AuthProvider.test.tsx, LoginPage.test.tsx,
// http.test.ts).
describe("App", () => {
  it("shows the login page first, then the authenticated view after signing in", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), VALID_CREDENTIALS.email);
    await user.type(screen.getByLabelText("Password"), VALID_CREDENTIALS.password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText(VALID_CREDENTIALS.email)).toBeInTheDocument();
    });
    expect(screen.queryByRole("form", { name: "Sign in" })).not.toBeInTheDocument();

    // Continues past login into the travel planner: the city list loads, a
    // default city is selected, and its weather renders — all without any
    // further user action.
    expect(await screen.findByRole("combobox", { name: "City" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Current weather")).toBeInTheDocument();
    expect(screen.getByLabelText("7-day forecast")).toBeInTheDocument();

    // The authenticated view has a real <h1> naming the page, for
    // screen-reader/document-outline navigation — not just visible text.
    const heading = screen.getByRole("heading", { level: 1, name: "Jambo Travel Planner" });
    expect(heading).toBeInTheDocument();
    // Focus moves there on the login → authenticated-view transition,
    // since the "Sign in" button that had it is now unmounted — without
    // this, focus would land on nothing in particular for a keyboard/
    // screen-reader user.
    expect(heading).toHaveFocus();
  });
});
