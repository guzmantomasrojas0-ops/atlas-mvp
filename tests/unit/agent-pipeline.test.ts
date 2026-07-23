import { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  evaluatePolicy,
  runAgentPipeline,
  ToolRegistry,
  type AgentContext,
  type Intent,
} from "@/modules/agent/domain";
import { todayInTimezone } from "@/modules/scheduling/domain";

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    businessId: "biz-1",
    businessName: "Barbería El Buen Corte",
    businessTimezone: "America/Bogota",
    conversationId: "conv-1",
    clientId: "client-1",
    clientName: "María Gómez",
    services: [{ id: "s1", name: "Corte de pelo", price: 25000, durationMinutes: 30 }],
    staff: [{ id: "st1", name: "Ana Gómez", role: "Barbera" }],
    upcomingAppointments: [],
    pastAppointments: [],
    recentMessages: [],
    ...overrides,
  };
}

function resolverThatAlwaysReturns(intent: Intent) {
  return async () => intent;
}

const anyInputSchema = z.unknown();

describe("runAgentPipeline", () => {
  it("resuelve intent y evalúa política, pero no planea ni ejecuta nada si la tool mapeada no está registrada", async () => {
    const result = await runAgentPipeline("¿qué horarios tienen mañana?", context(), {
      resolveIntent: resolverThatAlwaysReturns("CHECK_AVAILABILITY"),
      evaluatePolicy,
      toolRegistry: new ToolRegistry(),
    });

    expect(result.intent).toBe("CHECK_AVAILABILITY");
    expect(result.plannedAction).toBeNull();
    expect(result.execution).toBeNull();
  });

  it("BOOK_APPOINTMENT/CANCEL_APPOINTMENT/RESCHEDULE_APPOINTMENT nunca se planean por este pipeline, aunque CREATE_APPOINTMENT esté registrada", async () => {
    // Sprint 14: el pipeline por reglas no tiene ningún concepto de "el
    // cliente confirmó" — por eso estos tres intents quedan sin mapeo a
    // propósito, incluso con la tool real disponible en el registro.
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "CREATE_APPOINTMENT",
      description: "Crea una cita",
      inputSchema: anyInputSchema,
      execute: async (input) => input,
    });

    for (const intent of [
      "BOOK_APPOINTMENT",
      "CANCEL_APPOINTMENT",
      "RESCHEDULE_APPOINTMENT",
    ] as const) {
      const result = await runAgentPipeline("mensaje", context({ upcomingAppointments: [] }), {
        resolveIntent: resolverThatAlwaysReturns(intent),
        evaluatePolicy,
        toolRegistry,
      });

      expect(result.plannedAction).toBeNull();
      expect(result.execution).toBeNull();
    }
  });

  it("ejecuta la tool planeada y devuelve el resultado estructurado, sin generar ninguna respuesta en lenguaje natural", async () => {
    const toolRegistry = new ToolRegistry();
    let executed = false;
    toolRegistry.register({
      name: "GET_BUSINESS_HOURS",
      description: "Consulta el horario",
      inputSchema: anyInputSchema,
      execute: async () => {
        executed = true;
        return { openHour: 8, closeHour: 20 };
      },
    });

    const result = await runAgentPipeline("a que hora abren", context(), {
      resolveIntent: resolverThatAlwaysReturns("ASK_HOURS"),
      evaluatePolicy,
      toolRegistry,
    });

    expect(executed).toBe(true);
    expect(result.plannedAction).toEqual({
      tool: "GET_BUSINESS_HOURS",
      input: { businessName: context().businessName, businessTimezone: context().businessTimezone },
      reason: result.decision.reason,
    });
    expect(result.execution).toMatchObject({
      success: true,
      toolName: "GET_BUSINESS_HOURS",
      payload: { openHour: 8, closeHour: 20 },
      error: null,
    });
    expect(typeof result.execution?.executionTimeMs).toBe("number");
    expect(result).not.toHaveProperty("response");
  });

  it("planea y ejecuta SEARCH_AVAILABILITY para CHECK_AVAILABILITY, con el input derivado del contexto", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "SEARCH_AVAILABILITY",
      description: "Busca horarios libres",
      inputSchema: anyInputSchema,
      execute: async (input) => input,
    });

    const ctx = context();
    const result = await runAgentPipeline("¿qué horarios tienen mañana?", ctx, {
      resolveIntent: resolverThatAlwaysReturns("CHECK_AVAILABILITY"),
      evaluatePolicy,
      toolRegistry,
    });

    expect(result.plannedAction).toEqual({
      tool: "SEARCH_AVAILABILITY",
      input: {
        businessId: ctx.businessId,
        businessTimezone: ctx.businessTimezone,
        date: todayInTimezone(ctx.businessTimezone),
        serviceDurationMinutes: ctx.services[0].durationMinutes,
      },
      reason: result.decision.reason,
    });
    expect(result.execution?.success).toBe(true);
  });

  it("si la tool tira una excepción, el resultado de ejecución la representa como error en vez de propagarla", async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      name: "GET_BUSINESS_HOURS",
      description: "Consulta el horario",
      inputSchema: anyInputSchema,
      execute: async () => {
        throw new Error("boom");
      },
    });

    const result = await runAgentPipeline("a que hora abren", context(), {
      resolveIntent: resolverThatAlwaysReturns("ASK_HOURS"),
      evaluatePolicy,
      toolRegistry,
    });

    expect(result.execution?.success).toBe(false);
    expect(result.execution?.error?.code).toBe("INTERNAL_ERROR");
  });

  it("conserva el contexto y el mensaje original en el resultado", async () => {
    const ctx = context();
    const result = await runAgentPipeline("hola!", ctx, {
      resolveIntent: resolverThatAlwaysReturns("GREETING"),
      evaluatePolicy,
      toolRegistry: new ToolRegistry(),
    });

    expect(result.message).toBe("hola!");
    expect(result.context).toBe(ctx);
  });
});
