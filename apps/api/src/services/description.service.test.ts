import { describe, expect, it, vi } from "vitest";
import { createDescriptionService, type CityDescription } from "./description.service.js";

describe("description service", () => {
  it("delegates to the injected Wikipedia client with the given title", async () => {
    const cityDescription: CityDescription = {
      title: "Calgary",
      description: "A city in Alberta.",
      sourceUrl: "https://en.wikipedia.org/wiki/Calgary",
    };
    const wikipediaClient = { getSummary: vi.fn().mockResolvedValue(cityDescription) };
    const service = createDescriptionService({ wikipediaClient });

    const result = await service.getCityDescription("Calgary");

    expect(wikipediaClient.getSummary).toHaveBeenCalledWith("Calgary");
    expect(result).toBe(cityDescription);
  });

  it("propagates a rejection from the client rather than swallowing it", async () => {
    const wikipediaClient = { getSummary: vi.fn().mockRejectedValue(new Error("upstream failed")) };
    const service = createDescriptionService({ wikipediaClient });

    await expect(service.getCityDescription("Calgary")).rejects.toThrow("upstream failed");
  });
});
