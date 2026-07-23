import { describe, expect, it } from "vitest";
import { registerDefaultTools, ToolRegistry } from "@/modules/agent";

describe("registerDefaultTools", () => {
  it("registra las 6 herramientas de solo lectura (Sprint 8 + PREPARE_BOOKING_SUMMARY del Sprint 13) y CREATE_APPOINTMENT (Sprint 14)", () => {
    const registry = new ToolRegistry();
    registerDefaultTools(registry);

    expect(
      registry
        .list()
        .map((tool) => tool.name)
        .sort(),
    ).toEqual([
      "CREATE_APPOINTMENT",
      "FIND_SERVICE",
      "FIND_STAFF",
      "GET_BUSINESS_HOURS",
      "GET_UPCOMING_APPOINTMENTS",
      "PREPARE_BOOKING_SUMMARY",
      "SEARCH_AVAILABILITY",
    ]);
  });

  it("todavía no registra ninguna herramienta que cancele o modifique una reserva existente", () => {
    const registry = new ToolRegistry();
    registerDefaultTools(registry);

    expect(registry.has("CANCEL_APPOINTMENT")).toBe(false);
    expect(registry.has("UPDATE_APPOINTMENT")).toBe(false);
  });

  it("tira si se llama dos veces sobre el mismo registro", () => {
    const registry = new ToolRegistry();
    registerDefaultTools(registry);

    expect(() => registerDefaultTools(registry)).toThrow();
  });
});
