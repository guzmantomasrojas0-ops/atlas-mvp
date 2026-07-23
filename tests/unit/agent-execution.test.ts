import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  executeTool,
  ToolAlreadyRegisteredError,
  ToolRegistry,
  type Tool,
} from "@/modules/agent/domain";

function registryWith<TInput, TOutput>(tool: Tool<TInput, TOutput>): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(tool as Tool);
  return registry;
}

describe("executeTool", () => {
  it("ejecuta la tool y devuelve success con el payload real", async () => {
    const registry = registryWith({
      name: "GET_BUSINESS_HOURS",
      description: "Consulta el horario",
      inputSchema: z.object({ businessName: z.string() }),
      execute: async (input) => ({ echoedName: input.businessName }),
    });

    const result = await executeTool(
      "GET_BUSINESS_HOURS",
      { businessName: "Barbería El Buen Corte" },
      registry,
    );

    expect(result).toMatchObject({
      success: true,
      toolName: "GET_BUSINESS_HOURS",
      payload: { echoedName: "Barbería El Buen Corte" },
      error: null,
      metadata: {},
    });
    expect(typeof result.executionTimeMs).toBe("number");
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("devuelve TOOL_NOT_FOUND cuando la herramienta no está registrada", async () => {
    const result = await executeTool("FIND_SERVICE", {}, new ToolRegistry());

    expect(result.success).toBe(false);
    expect(result.toolName).toBe("FIND_SERVICE");
    expect(result.payload).toBeNull();
    expect(result.error).toEqual({
      code: "TOOL_NOT_FOUND",
      message: 'No existe una herramienta registrada con el nombre "FIND_SERVICE".',
    });
  });

  it("devuelve INVALID_INPUT cuando el input no pasa el inputSchema de la tool", async () => {
    const registry = registryWith({
      name: "FIND_SERVICE",
      description: "Busca servicios",
      inputSchema: z.object({ businessId: z.string().min(1) }),
      execute: async (input) => input,
    });

    const result = await executeTool("FIND_SERVICE", { businessId: "" }, registry);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INVALID_INPUT");
    expect(result.metadata.issues).toBeDefined();
    expect(Array.isArray(result.metadata.issues)).toBe(true);
  });

  it("devuelve BUSINESS_ERROR cuando la tool tira un AppError, preservando su código original en metadata", async () => {
    const registry = registryWith({
      name: "FIND_STAFF",
      description: "Busca staff",
      inputSchema: z.unknown(),
      execute: async () => {
        throw new ToolAlreadyRegisteredError("Ya existe.");
      },
    });

    const result = await executeTool("FIND_STAFF", {}, registry);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({ code: "BUSINESS_ERROR", message: "Ya existe." });
    expect(result.metadata.appErrorCode).toBe("TOOL_ALREADY_REGISTERED");
  });

  it("devuelve INTERNAL_ERROR cuando la tool tira un error inesperado", async () => {
    const registry = registryWith({
      name: "GET_UPCOMING_APPOINTMENTS",
      description: "Consulta reservas próximas",
      inputSchema: z.unknown(),
      execute: async () => {
        throw new Error("algo explotó");
      },
    });

    const result = await executeTool("GET_UPCOMING_APPOINTMENTS", {}, registry);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({ code: "INTERNAL_ERROR", message: "algo explotó" });
  });

  it("devuelve INTERNAL_ERROR incluso si lo que se tira no es una instancia de Error", async () => {
    const registry = registryWith({
      name: "SEARCH_AVAILABILITY",
      description: "Busca disponibilidad",
      inputSchema: z.unknown(),
      execute: async () => {
        throw "un string cualquiera";
      },
    });

    const result = await executeTool("SEARCH_AVAILABILITY", {}, registry);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message.length).toBeGreaterThan(0);
  });

  it("nunca deja escapar una excepción — siempre devuelve un ToolExecutionResult", async () => {
    const registry = registryWith({
      name: "FIND_SERVICE",
      description: "Busca servicios",
      inputSchema: z.object({ businessId: z.string() }),
      execute: async () => {
        throw new Error("no debería propagarse");
      },
    });

    await expect(
      executeTool("FIND_SERVICE", { businessId: "biz-1" }, registry),
    ).resolves.toMatchObject({ success: false });
  });
});
