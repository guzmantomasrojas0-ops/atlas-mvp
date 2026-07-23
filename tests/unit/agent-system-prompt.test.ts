import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type AgentContext } from "@/modules/agent/domain";

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

describe("buildSystemPrompt", () => {
  it("incluye el nombre del negocio y del cliente", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt).toContain("Barbería El Buen Corte");
    expect(prompt).toContain("María Gómez");
  });

  it("incluye cada servicio con precio y duración", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt).toContain("Corte de pelo");
    expect(prompt).toContain("25.000");
    expect(prompt).toContain("30 min");
  });

  it("incluye cada miembro del equipo con su rol", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt).toContain("Ana Gómez");
    expect(prompt).toContain("Barbera");
  });

  it("muestra un mensaje claro cuando no hay servicios ni equipo cargados", () => {
    const prompt = buildSystemPrompt(context({ services: [], staff: [] }));
    expect(prompt).toContain("Todavía no hay servicios cargados.");
    expect(prompt).toContain("Todavía no hay miembros del equipo cargados.");
  });

  it("lista las reservas próximas del cliente, si tiene", () => {
    const prompt = buildSystemPrompt(
      context({
        upcomingAppointments: [
          {
            id: "a1",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-07-23T15:00:00.000Z"),
            endsAt: new Date("2026-07-23T15:30:00.000Z"),
          },
        ],
      }),
    );
    expect(prompt).toContain("Corte de pelo con Ana Gómez");
  });

  it("dice explícitamente que no tiene reservas próximas cuando no hay ninguna", () => {
    const prompt = buildSystemPrompt(context({ upcomingAppointments: [] }));
    expect(prompt).toContain("No tiene ninguna reserva próxima.");
  });

  it("instruye a usar las herramientas en vez de inventar datos, y a no cancelar/modificar reservas todavía", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt.toLowerCase()).toContain("nunca inventes");
    expect(prompt.toLowerCase()).toContain("todavía no podés cancelar ni modificar reservas");
  });

  it("instruye a pedir confirmación explícita antes de llamar a CREATE_APPOINTMENT, nunca en la misma respuesta que el resumen", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt).toContain("CREATE_APPOINTMENT");
    expect(prompt.toLowerCase()).toContain("confirmación explícita");
    expect(prompt.toLowerCase()).toContain("nunca la crees");
  });

  it("instruye a reaccionar naturalmente al resultado de CREATE_APPOINTMENT, tanto si sale bien como si falla", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt.toLowerCase()).toContain("nunca digas que la reserva se hizo");
    expect(prompt).toContain("SEARCH_AVAILABILITY");
  });

  it("instruye a responder siempre en español y en texto natural, nunca JSON", () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt.toLowerCase()).toContain("español");
    expect(prompt.toLowerCase()).toContain("nunca json ni código");
  });
});
