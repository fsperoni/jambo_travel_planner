import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ForecastDatePicker } from "./ForecastDatePicker";

describe("ForecastDatePicker", () => {
  it("renders a date input with min/max bound to the allowed range", () => {
    render(
      <ForecastDatePicker min="2026-09-27" max="2026-10-02" value={null} onChange={() => {}} />,
    );

    const input = screen.getByLabelText("See forecast for a specific day");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveAttribute("min", "2026-09-27");
    expect(input).toHaveAttribute("max", "2026-10-02");
    expect(input).toHaveValue("");
  });

  it("reflects a selected value", () => {
    render(
      <ForecastDatePicker
        min="2026-09-27"
        max="2026-10-02"
        value="2026-09-29"
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("See forecast for a specific day")).toHaveValue("2026-09-29");
  });

  it("calls onChange with the picked date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ForecastDatePicker min="2026-09-27" max="2026-10-02" value={null} onChange={onChange} />,
    );

    await user.type(screen.getByLabelText("See forecast for a specific day"), "2026-09-29");

    expect(onChange).toHaveBeenLastCalledWith("2026-09-29");
  });

  it("calls onChange with null when the date is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ForecastDatePicker
        min="2026-09-27"
        max="2026-10-02"
        value="2026-09-29"
        onChange={onChange}
      />,
    );

    await user.clear(screen.getByLabelText("See forecast for a specific day"));

    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
