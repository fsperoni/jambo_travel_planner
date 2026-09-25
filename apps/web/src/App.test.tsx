import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

// Scaffold-stage smoke test: proves the Vite + Vitest + React Testing Library
// pipeline works end to end. Replaced once the real app shell lands in Stage 3.
describe("App", () => {
  it("renders the scaffold placeholder", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Jambo Travel Planner" })).toBeInTheDocument();
  });
});
