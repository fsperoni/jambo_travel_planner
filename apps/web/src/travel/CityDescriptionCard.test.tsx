import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityDescriptionCard } from "./CityDescriptionCard";
import type { CityDescription } from "../api/types";

describe("CityDescriptionCard", () => {
  it("shows the description text and a Wikipedia attribution link when both are present", () => {
    const cityDescription: CityDescription = {
      title: "Calgary",
      description: "Calgary is the largest city in the Canadian province of Alberta.",
      sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
    };

    render(<CityDescriptionCard cityDescription={cityDescription} />);

    expect(screen.getByText(cityDescription.description!)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Read more on Wikipedia" });
    expect(link).toHaveAttribute("href", cityDescription.sourceUrl);
    expect(link).toHaveAttribute("target", "_blank");
    // rel="noopener noreferrer" — a target="_blank" link without it can let
    // the opened page access `window.opener` and navigate it.
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a named empty state, not an error, when there's no description", () => {
    const cityDescription: CityDescription = {
      title: "SomeObscurePlace",
      description: null,
      sourceUrl: null,
    };

    render(<CityDescriptionCard cityDescription={cityDescription} />);

    expect(screen.getByText(/No description available for SomeObscurePlace/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is labelled for assistive tech as the about-this-city region", () => {
    render(
      <CityDescriptionCard
        cityDescription={{ title: "Calgary", description: null, sourceUrl: null }}
      />,
    );

    expect(screen.getByLabelText("About this city")).toBeInTheDocument();
  });
});
