import { describe, expect, it } from "vitest";
import {
  findAvailableSlots,
  findConflict,
  isWithinBusinessHours,
  rangesOverlap,
} from "@/modules/scheduling/domain";

const TIMEZONE = "America/Bogota"; // UTC-5, sin horario de verano — simplifica los cálculos del test
const DATE = "2026-07-20";

function range(startsAt: string, endsAt: string) {
  return { startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}

describe("rangesOverlap", () => {
  it("detecta una superposición total", () => {
    const a = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const b = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it("detecta una superposición parcial", () => {
    const a = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const b = range("2026-07-20T10:30:00Z", "2026-07-20T11:30:00Z");
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it("detecta que un rango contiene completamente al otro", () => {
    const a = range("2026-07-20T09:00:00Z", "2026-07-20T12:00:00Z");
    const b = range("2026-07-20T10:00:00Z", "2026-07-20T10:30:00Z");
    expect(rangesOverlap(a, b)).toBe(true);
    expect(rangesOverlap(b, a)).toBe(true);
  });

  it("NO considera conflicto cuando un rango termina justo cuando empieza el otro", () => {
    const a = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const b = range("2026-07-20T11:00:00Z", "2026-07-20T12:00:00Z");
    expect(rangesOverlap(a, b)).toBe(false);
    expect(rangesOverlap(b, a)).toBe(false);
  });

  it("NO considera conflicto cuando los rangos no se tocan", () => {
    const a = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const b = range("2026-07-20T14:00:00Z", "2026-07-20T15:00:00Z");
    expect(rangesOverlap(a, b)).toBe(false);
  });
});

describe("findConflict", () => {
  it("devuelve el primer rango existente que se superpone", () => {
    const candidate = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const existing = [
      range("2026-07-20T08:00:00Z", "2026-07-20T09:00:00Z"),
      range("2026-07-20T10:30:00Z", "2026-07-20T11:30:00Z"),
    ];
    expect(findConflict(candidate, existing)).toBe(existing[1]);
  });

  it("devuelve undefined cuando no hay ningún conflicto", () => {
    const candidate = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    const existing = [range("2026-07-20T08:00:00Z", "2026-07-20T09:00:00Z")];
    expect(findConflict(candidate, existing)).toBeUndefined();
  });

  it("devuelve undefined con una lista vacía", () => {
    const candidate = range("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z");
    expect(findConflict(candidate, [])).toBeUndefined();
  });
});

describe("findAvailableSlots", () => {
  it("genera un slot cada 30 minutos dentro de la ventana horaria, sin reservas", () => {
    const slots = findAvailableSlots(DATE, TIMEZONE, 30, []);

    // 08:00 a 20:00, cada 30 minutos: 24 slots de 30 minutos.
    expect(slots).toHaveLength(24);
    expect(slots[0].startsAt).toEqual(new Date("2026-07-20T13:00:00.000Z")); // 08:00 Bogotá = 13:00 UTC
    expect(slots[0].endsAt).toEqual(new Date("2026-07-20T13:30:00.000Z"));
    expect(slots[slots.length - 1].startsAt).toEqual(new Date("2026-07-21T00:30:00.000Z")); // 19:30 Bogotá
    expect(slots[slots.length - 1].endsAt).toEqual(new Date("2026-07-21T01:00:00.000Z")); // 20:00 Bogotá
  });

  it("no ofrece un slot que terminaría después del cierre", () => {
    // Con una duración de 60 minutos, el último slot válido empieza a las 19:00 (termina 20:00).
    const slots = findAvailableSlots(DATE, TIMEZONE, 60, []);
    const lastSlot = slots[slots.length - 1];

    expect(lastSlot.endsAt).toEqual(new Date("2026-07-21T01:00:00.000Z")); // 20:00 Bogotá
    expect(slots).toHaveLength(23); // de 08:00 a 19:00, cada 30 min
  });

  it("descarta los slots que chocan con una reserva existente", () => {
    const existingBooking = range("2026-07-20T13:00:00Z", "2026-07-20T13:30:00Z"); // 08:00-08:30 Bogotá
    const slots = findAvailableSlots(DATE, TIMEZONE, 30, [existingBooking]);

    expect(slots).toHaveLength(23);
    expect(
      slots.some((slot) => slot.startsAt.getTime() === existingBooking.startsAt.getTime()),
    ).toBe(false);
  });

  it("una reserva larga puede tapar varios slots candidatos", () => {
    // 08:00-09:00 Bogotá ocupa los slots de 08:00 y 08:30.
    const existingBooking = range("2026-07-20T13:00:00Z", "2026-07-20T14:00:00Z");
    const slots = findAvailableSlots(DATE, TIMEZONE, 30, [existingBooking]);

    expect(slots).toHaveLength(22);
    expect(slots[0].startsAt).toEqual(new Date("2026-07-20T14:00:00.000Z")); // 09:00 Bogotá
  });

  it("no devuelve ningún slot cuando la duración no entra ni una vez en la ventana", () => {
    const slots = findAvailableSlots(DATE, TIMEZONE, 13 * 60, []); // 13 horas, más que la ventana de 12
    expect(slots).toEqual([]);
  });

  it("devuelve exactamente un slot cuando la duración ocupa toda la ventana", () => {
    const slots = findAvailableSlots(DATE, TIMEZONE, 12 * 60, []); // 08:00-20:00 = 12 horas exactas
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt).toEqual(new Date("2026-07-20T13:00:00.000Z")); // 08:00 Bogotá
    expect(slots[0].endsAt).toEqual(new Date("2026-07-21T01:00:00.000Z")); // 20:00 Bogotá
  });
});

describe("isWithinBusinessHours", () => {
  it("acepta un rango entero dentro de la ventana 08:00-20:00", () => {
    const startsAt = new Date("2026-07-20T13:00:00.000Z"); // 08:00 Bogotá
    const endsAt = new Date("2026-07-20T13:30:00.000Z"); // 08:30 Bogotá
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(true);
  });

  it("acepta un rango que empieza y termina exactamente en los bordes de la ventana", () => {
    const startsAt = new Date("2026-07-20T13:00:00.000Z"); // 08:00 Bogotá
    const endsAt = new Date("2026-07-21T01:00:00.000Z"); // 20:00 Bogotá del mismo día
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(true);
  });

  it("rechaza un horario que empieza antes de la apertura", () => {
    const startsAt = new Date("2026-07-20T12:30:00.000Z"); // 07:30 Bogotá
    const endsAt = new Date("2026-07-20T13:00:00.000Z"); // 08:00 Bogotá
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(false);
  });

  it("rechaza un horario que termina después del cierre", () => {
    const startsAt = new Date("2026-07-21T00:30:00.000Z"); // 19:30 Bogotá
    const endsAt = new Date("2026-07-21T01:30:00.000Z"); // 20:30 Bogotá
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(false);
  });

  it("rechaza un horario de madrugada, fuera de la ventana por completo", () => {
    const startsAt = new Date("2026-07-20T08:00:00.000Z"); // 03:00 Bogotá
    const endsAt = new Date("2026-07-20T08:30:00.000Z"); // 03:30 Bogotá
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(false);
  });

  it("rechaza un rango que cruza la medianoche local", () => {
    const startsAt = new Date("2026-07-21T04:30:00.000Z"); // 23:30 Bogotá (20/07)
    const endsAt = new Date("2026-07-21T05:00:00.000Z"); // 00:00 Bogotá (21/07)
    expect(isWithinBusinessHours(startsAt, endsAt, TIMEZONE)).toBe(false);
  });
});
