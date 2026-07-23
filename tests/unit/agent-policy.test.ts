import { describe, expect, it } from "vitest";
import { evaluatePolicy, type AgentContext } from "@/modules/agent/domain";

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    businessId: "biz-1",
    businessName: "Barbería El Buen Corte",
    businessTimezone: "America/Bogota",
    conversationId: "conv-1",
    clientId: "client-1",
    clientName: "María Gómez",
    services: [],
    staff: [],
    upcomingAppointments: [],
    pastAppointments: [],
    recentMessages: [],
    ...overrides,
  };
}

const APPOINTMENT = {
  id: "appt-1",
  serviceName: "Corte de pelo",
  staffName: "Ana Gómez",
  startsAt: new Date("2026-07-25T10:00:00Z"),
  endsAt: new Date("2026-07-25T10:30:00Z"),
};

describe("evaluatePolicy", () => {
  it("REQUEST_HUMAN siempre escala, sin importar el contexto", () => {
    const decision = evaluatePolicy("REQUEST_HUMAN", context());
    expect(decision.shouldEscalateToHuman).toBe(true);
    expect(decision.canBook).toBe(false);
  });

  it("BOOK_APPOINTMENT permite reservar solo si hay servicios y equipo", () => {
    const withBoth = evaluatePolicy(
      "BOOK_APPOINTMENT",
      context({
        services: [{ id: "s1", name: "Corte", price: 1, durationMinutes: 30 }],
        staff: [{ id: "st1", name: "Ana", role: "Barbera" }],
      }),
    );
    expect(withBoth.canBook).toBe(true);
    expect(withBoth.requiresConfirmation).toBe(true);

    const withoutStaff = evaluatePolicy(
      "BOOK_APPOINTMENT",
      context({
        services: [{ id: "s1", name: "Corte", price: 1, durationMinutes: 30 }],
        staff: [],
      }),
    );
    expect(withoutStaff.canBook).toBe(false);

    const withNeither = evaluatePolicy("BOOK_APPOINTMENT", context());
    expect(withNeither.canBook).toBe(false);
  });

  it("CANCEL_APPOINTMENT solo si el cliente tiene una reserva próxima", () => {
    const withUpcoming = evaluatePolicy(
      "CANCEL_APPOINTMENT",
      context({ upcomingAppointments: [APPOINTMENT] }),
    );
    expect(withUpcoming.canCancel).toBe(true);
    expect(withUpcoming.requiresConfirmation).toBe(true);

    const withoutUpcoming = evaluatePolicy("CANCEL_APPOINTMENT", context());
    expect(withoutUpcoming.canCancel).toBe(false);
  });

  it("RESCHEDULE_APPOINTMENT solo si el cliente tiene una reserva próxima", () => {
    const withUpcoming = evaluatePolicy(
      "RESCHEDULE_APPOINTMENT",
      context({ upcomingAppointments: [APPOINTMENT] }),
    );
    expect(withUpcoming.canReschedule).toBe(true);

    const withoutUpcoming = evaluatePolicy("RESCHEDULE_APPOINTMENT", context());
    expect(withoutUpcoming.canReschedule).toBe(false);
  });

  it.each(["CHECK_AVAILABILITY", "ASK_HOURS", "ASK_PRICE", "GREETING", "FAREWELL"] as const)(
    "%s no habilita ninguna acción ni escala",
    (intent) => {
      const decision = evaluatePolicy(intent, context());
      expect(decision.canBook).toBe(false);
      expect(decision.canCancel).toBe(false);
      expect(decision.canReschedule).toBe(false);
      expect(decision.shouldEscalateToHuman).toBe(false);
      expect(decision.requiresConfirmation).toBe(false);
    },
  );

  it("OTHER escala a humano porque ATLAS no debe adivinar", () => {
    const decision = evaluatePolicy("OTHER", context());
    expect(decision.shouldEscalateToHuman).toBe(true);
  });

  it("toda decisión incluye el intent original y una razón no vacía", () => {
    const decision = evaluatePolicy("GREETING", context());
    expect(decision.intent).toBe("GREETING");
    expect(decision.reason.length).toBeGreaterThan(0);
  });
});
