import { describe, expect, it } from "vitest";
import { composeNotificationMessage } from "@/modules/notifications";
import type { NotifiableAppointment } from "@/modules/notifications";

const APPOINTMENT: NotifiableAppointment = {
  id: "apt-1",
  startsAt: new Date("2026-07-23T15:00:00Z"), // 10:00 America/Bogota
  endsAt: new Date("2026-07-23T15:30:00Z"),
  clientName: "Rosa Martínez",
  clientPhone: "+57 300 555 0199",
  staffName: "Ana Gómez",
  serviceName: "Corte de pelo",
};

describe("composeNotificationMessage", () => {
  it("REMINDER_24H incluye cliente, servicio, fecha, hora local, staff y negocio", () => {
    const text = composeNotificationMessage(
      "REMINDER_24H",
      APPOINTMENT,
      "Barbería El Buen Corte",
      "America/Bogota",
    );
    expect(text).toContain("Rosa Martínez");
    expect(text).toContain("Corte de pelo");
    expect(text).toContain("10:00");
    expect(text).toContain("Ana Gómez");
    expect(text).toContain("Barbería El Buen Corte");
  });

  it("REMINDER_2H es más corto y no menciona la fecha, solo la hora", () => {
    const text = composeNotificationMessage(
      "REMINDER_2H",
      APPOINTMENT,
      "Barbería El Buen Corte",
      "America/Bogota",
    );
    expect(text).toContain("10:00");
    expect(text).toContain("Rosa Martínez");
    expect(text).toContain("hoy");
  });

  it("THANK_YOU agradece sin mencionar horarios", () => {
    const text = composeNotificationMessage(
      "THANK_YOU",
      APPOINTMENT,
      "Barbería El Buen Corte",
      "America/Bogota",
    );
    expect(text).toContain("Gracias");
    expect(text).toContain("Rosa Martínez");
    expect(text).toContain("Corte de pelo");
  });

  it("formatea la hora según la zona horaria del negocio, no UTC", () => {
    const textBogota = composeNotificationMessage(
      "REMINDER_2H",
      APPOINTMENT,
      "Negocio",
      "America/Bogota",
    );
    const textNewYork = composeNotificationMessage(
      "REMINDER_2H",
      APPOINTMENT,
      "Negocio",
      "America/New_York",
    );
    expect(textBogota).toContain("10:00");
    expect(textNewYork).not.toContain("10:00");
  });
});
