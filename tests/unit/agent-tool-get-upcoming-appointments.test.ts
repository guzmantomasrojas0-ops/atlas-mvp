import { describe, expect, it } from "vitest";
import {
  getUpcomingAppointmentsTool,
  selectUpcomingAppointments,
  type UpcomingAppointment,
} from "@/modules/agent";

const NOW = new Date("2026-07-19T12:00:00Z");

function appointment(id: string, startsAt: string): UpcomingAppointment {
  return {
    id,
    serviceName: "Corte de pelo",
    staffName: "Ana Gómez",
    startsAt: new Date(startsAt),
    endsAt: new Date(new Date(startsAt).getTime() + 30 * 60 * 1000),
  };
}

describe("selectUpcomingAppointments", () => {
  it("descarta las reservas pasadas", () => {
    const past = appointment("past", "2026-07-10T10:00:00Z");
    const future = appointment("future", "2026-07-25T10:00:00Z");

    expect(selectUpcomingAppointments([past, future], NOW)).toEqual([future]);
  });

  it("una reserva que empieza exactamente ahora no cuenta como próxima", () => {
    const rightNow = appointment("right-now", NOW.toISOString());
    expect(selectUpcomingAppointments([rightNow], NOW)).toEqual([]);
  });

  it("ordena de la más cercana a la más lejana", () => {
    const later = appointment("later", "2026-08-01T10:00:00Z");
    const sooner = appointment("sooner", "2026-07-20T10:00:00Z");

    expect(selectUpcomingAppointments([later, sooner], NOW).map((a) => a.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("devuelve una lista vacía si no hay ninguna próxima", () => {
    expect(selectUpcomingAppointments([], NOW)).toEqual([]);
  });
});

describe("getUpcomingAppointmentsTool", () => {
  it("declara su nombre", () => {
    expect(getUpcomingAppointmentsTool.name).toBe("GET_UPCOMING_APPOINTMENTS");
  });
});
