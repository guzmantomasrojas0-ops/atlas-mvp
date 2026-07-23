import { describe, expect, it } from "vitest";
import { buildAgentContext, type RawAgentContextInputs } from "@/modules/agent/domain";

const NOW = new Date("2026-07-19T12:00:00Z");

function raw(overrides: Partial<RawAgentContextInputs> = {}): RawAgentContextInputs {
  return {
    businessId: "biz-1",
    businessName: "Barbería El Buen Corte",
    businessTimezone: "America/Bogota",
    conversationId: "conv-1",
    clientId: "client-1",
    clientName: "María Gómez",
    services: [],
    staff: [],
    appointments: [],
    recentMessages: [],
    ...overrides,
  };
}

describe("buildAgentContext", () => {
  it("separa citas futuras de pasadas respecto a `now`", () => {
    const context = buildAgentContext(
      raw({
        appointments: [
          {
            id: "past",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-07-10T10:00:00Z"),
            endsAt: new Date("2026-07-10T10:30:00Z"),
          },
          {
            id: "future",
            serviceName: "Corte y barba",
            staffName: "Beto Ruiz",
            startsAt: new Date("2026-07-25T10:00:00Z"),
            endsAt: new Date("2026-07-25T10:45:00Z"),
          },
        ],
      }),
      NOW,
    );

    expect(context.upcomingAppointments.map((a) => a.id)).toEqual(["future"]);
    expect(context.pastAppointments.map((a) => a.id)).toEqual(["past"]);
  });

  it("una cita que empieza exactamente ahora cuenta como pasada", () => {
    const context = buildAgentContext(
      raw({
        appointments: [
          {
            id: "right-now",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: NOW,
            endsAt: new Date(NOW.getTime() + 30 * 60 * 1000),
          },
        ],
      }),
      NOW,
    );

    expect(context.upcomingAppointments).toHaveLength(0);
    expect(context.pastAppointments.map((a) => a.id)).toEqual(["right-now"]);
  });

  it("ordena las próximas de más cercana a más lejana", () => {
    const context = buildAgentContext(
      raw({
        appointments: [
          {
            id: "later",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-08-01T10:00:00Z"),
            endsAt: new Date("2026-08-01T10:30:00Z"),
          },
          {
            id: "sooner",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-07-20T10:00:00Z"),
            endsAt: new Date("2026-07-20T10:30:00Z"),
          },
        ],
      }),
      NOW,
    );

    expect(context.upcomingAppointments.map((a) => a.id)).toEqual(["sooner", "later"]);
  });

  it("ordena las pasadas de más reciente a más antigua", () => {
    const context = buildAgentContext(
      raw({
        appointments: [
          {
            id: "older",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-06-01T10:00:00Z"),
            endsAt: new Date("2026-06-01T10:30:00Z"),
          },
          {
            id: "recent",
            serviceName: "Corte de pelo",
            staffName: "Ana Gómez",
            startsAt: new Date("2026-07-01T10:00:00Z"),
            endsAt: new Date("2026-07-01T10:30:00Z"),
          },
        ],
      }),
      NOW,
    );

    expect(context.pastAppointments.map((a) => a.id)).toEqual(["recent", "older"]);
  });

  it("pasa servicios, equipo y mensajes recientes sin transformar", () => {
    const services = [{ id: "s1", name: "Corte de pelo", price: 25000, durationMinutes: 30 }];
    const staff = [{ id: "st1", name: "Ana Gómez", role: "Barbera" }];
    const recentMessages = [
      { sender: "CLIENT" as const, content: "Hola", createdAt: new Date("2026-07-19T11:00:00Z") },
    ];

    const context = buildAgentContext(raw({ services, staff, recentMessages }), NOW);

    expect(context.services).toEqual(services);
    expect(context.staff).toEqual(staff);
    expect(context.recentMessages).toEqual(recentMessages);
  });
});
