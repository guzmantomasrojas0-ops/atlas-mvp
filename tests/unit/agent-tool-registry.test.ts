import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ToolAlreadyRegisteredError, ToolRegistry, type Tool } from "@/modules/agent/domain";

function fakeTool(name: Tool["name"]): Tool {
  return {
    name,
    description: `Herramienta de prueba: ${name}`,
    inputSchema: z.unknown(),
    execute: async (input) => input,
  };
}

describe("ToolRegistry", () => {
  it("empieza vacío", () => {
    const registry = new ToolRegistry();
    expect(registry.list()).toEqual([]);
    expect(registry.has("GET_BUSINESS_HOURS")).toBe(false);
    expect(registry.get("GET_BUSINESS_HOURS")).toBeUndefined();
  });

  it("registra y devuelve una herramienta", () => {
    const registry = new ToolRegistry();
    const tool = fakeTool("GET_BUSINESS_HOURS");

    registry.register(tool);

    expect(registry.has("GET_BUSINESS_HOURS")).toBe(true);
    expect(registry.get("GET_BUSINESS_HOURS")).toBe(tool);
    expect(registry.list()).toEqual([tool]);
  });

  it("no permite registrar dos veces el mismo nombre", () => {
    const registry = new ToolRegistry();
    registry.register(fakeTool("CREATE_APPOINTMENT"));

    expect(() => registry.register(fakeTool("CREATE_APPOINTMENT"))).toThrow(
      ToolAlreadyRegisteredError,
    );
  });

  it("list() devuelve todas las herramientas registradas", () => {
    const registry = new ToolRegistry();
    registry.register(fakeTool("FIND_SERVICE"));
    registry.register(fakeTool("FIND_STAFF"));

    expect(
      registry
        .list()
        .map((tool) => tool.name)
        .sort(),
    ).toEqual(["FIND_SERVICE", "FIND_STAFF"]);
  });
});
