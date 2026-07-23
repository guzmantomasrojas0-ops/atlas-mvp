import { describe, expect, it } from "vitest";
import { computeDueNotifications } from "@/modules/notifications";
import type { ExistingNotificationRecord } from "@/modules/notifications";

const HOUR = 60 * 60 * 1000;

function appointment(startsAtIsoOffsetHours: number, durationMinutes = 30) {
  const startsAt = new Date(Date.now() + startsAtIsoOffsetHours * HOUR);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  return { startsAt, endsAt };
}

describe("computeDueNotifications", () => {
  it("no devuelve nada si la cita está lejos en el futuro (más de 24h)", () => {
    const due = computeDueNotifications(new Date(), appointment(48), []);
    expect(due).toEqual([]);
  });

  it("el recordatorio de 24h está due apenas se entra en la ventana de 24h", () => {
    const due = computeDueNotifications(new Date(), appointment(23.5), []);
    expect(due).toEqual([{ type: "REMINDER_24H", targetAt: expect.any(Date), isRetry: false }]);
  });

  it("el recordatorio de 2h está due apenas se entra en esa ventana, y el de 24h ya no (asumiendo que ya se envió)", () => {
    const apt = appointment(1.5);
    const existing24h: ExistingNotificationRecord[] = [
      {
        type: "REMINDER_24H",
        targetAt: new Date(apt.startsAt.getTime() - 24 * HOUR),
        status: "SENT",
        attemptCount: 1,
      },
    ];
    const due = computeDueNotifications(new Date(), apt, existing24h);
    expect(due).toEqual([{ type: "REMINDER_2H", targetAt: expect.any(Date), isRetry: false }]);
  });

  it("no reenvía un recordatorio ya SENT para el mismo targetAt", () => {
    const apt = appointment(23);
    const targetAt = new Date(apt.startsAt.getTime() - 24 * HOUR);
    const existing: ExistingNotificationRecord[] = [
      { type: "REMINDER_24H", targetAt, status: "SENT", attemptCount: 1 },
    ];
    expect(computeDueNotifications(new Date(), apt, existing)).toEqual([]);
  });

  it("reintenta un FAILED con menos del máximo de intentos", () => {
    const apt = appointment(23);
    const targetAt = new Date(apt.startsAt.getTime() - 24 * HOUR);
    const existing: ExistingNotificationRecord[] = [
      { type: "REMINDER_24H", targetAt, status: "FAILED", attemptCount: 1 },
    ];
    const due = computeDueNotifications(new Date(), apt, existing);
    expect(due).toEqual([{ type: "REMINDER_24H", targetAt, isRetry: true }]);
  });

  it("no reintenta un FAILED que ya agotó el máximo de intentos", () => {
    const apt = appointment(23);
    const targetAt = new Date(apt.startsAt.getTime() - 24 * HOUR);
    const existing: ExistingNotificationRecord[] = [
      { type: "REMINDER_24H", targetAt, status: "FAILED", attemptCount: 3 },
    ];
    expect(computeDueNotifications(new Date(), apt, existing)).toEqual([]);
  });

  it("no envía recordatorios (24h/2h) si la cita ya empezó, pero sí el agradecimiento si ya terminó", () => {
    const apt = appointment(-1, 30); // empezó hace 1h, cita de 30 min: ya terminó.
    const due = computeDueNotifications(new Date(), apt, []);
    expect(due).toEqual([{ type: "THANK_YOU", targetAt: apt.endsAt, isRetry: false }]);
  });

  it("no envía el agradecimiento si la cita todavía no terminó", () => {
    const apt = appointment(-0.1, 30); // empezó hace 6 min, dura 30: todavía en curso.
    expect(computeDueNotifications(new Date(), apt, [])).toEqual([]);
  });

  it("una reprogramación (nuevo startsAt) vuelve a considerar due un recordatorio ya SENT para el horario viejo", () => {
    const apt = appointment(23); // dentro de la ventana de 24h para el horario ACTUAL
    const oldTargetAt = new Date(Date.now() - 5 * HOUR); // targetAt de un horario viejo ya distinto
    const existing: ExistingNotificationRecord[] = [
      { type: "REMINDER_24H", targetAt: oldTargetAt, status: "SENT", attemptCount: 1 },
    ];
    const due = computeDueNotifications(new Date(), apt, existing);
    expect(due).toEqual([{ type: "REMINDER_24H", targetAt: expect.any(Date), isRetry: false }]);
    expect(due[0].targetAt.getTime()).not.toBe(oldTargetAt.getTime());
  });

  it("devuelve 24h y 2h juntos si el scheduler no corrió por un tiempo largo antes de que la cita empiece", () => {
    const apt = appointment(1); // faltan 1h: tanto el target de 24h como el de 2h ya pasaron
    const due = computeDueNotifications(new Date(), apt, []);
    expect(due.map((d) => d.type).sort()).toEqual(["REMINDER_24H", "REMINDER_2H"]);
  });
});
