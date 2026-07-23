import { describe, expect, it } from "vitest";
import { searchAvailabilityTool } from "@/modules/agent";

describe("searchAvailabilityTool", () => {
  it("declara su nombre — la lógica real de slots libres se testea en el módulo scheduling", () => {
    expect(searchAvailabilityTool.name).toBe("SEARCH_AVAILABILITY");
    expect(typeof searchAvailabilityTool.execute).toBe("function");
  });
});
