import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { AuthProvider } from "../auth/AuthProvider";

/**
 * Renders a component wrapped in the same providers main.tsx wraps the
 * real app in. Every component under test needs AuthProvider in scope
 * (useAuth() throws without it) — this is the one place that wrapping is
 * defined, so it can't drift from what main.tsx actually does.
 */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<AuthProvider>{ui}</AuthProvider>);
}
