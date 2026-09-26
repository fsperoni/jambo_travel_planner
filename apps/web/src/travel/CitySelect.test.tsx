import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CitySelect } from "./CitySelect";
import type { City } from "../api/types";

const cities: City[] = [
  {
    id: "calgary",
    name: "Calgary",
    region: "Alberta",
    countryCode: "CA",
    latitude: 51.0447,
    longitude: -114.0719,
    wikipediaTitle: "Calgary",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    countryCode: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
    wikipediaTitle: "Tokyo",
  },
];

describe("CitySelect", () => {
  it("lists every city, showing the region when one exists", () => {
    render(<CitySelect cities={cities} selectedCityId="calgary" onChange={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Calgary, Alberta" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tokyo" })).toBeInTheDocument();
  });

  it("reflects the currently selected city", () => {
    render(<CitySelect cities={cities} selectedCityId="tokyo" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "City" })).toHaveValue("tokyo");
  });

  it("calls onChange with the newly selected city's id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CitySelect cities={cities} selectedCityId="calgary" onChange={onChange} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "City" }), "tokyo");

    expect(onChange).toHaveBeenCalledWith("tokyo");
  });
});
