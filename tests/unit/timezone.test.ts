import { describe, expect, it } from "vitest";
import {
  formatInBusinessTimezone,
  toBusinessLocalTime,
  toUtcInstant,
} from "@/modules/scheduling/domain";

describe("toUtcInstant", () => {
  it("convierte una hora local sin DST (America/Bogota, UTC-5) a UTC", () => {
    const utc = toUtcInstant("2026-07-20", "14:30", "America/Bogota");
    expect(utc.toISOString()).toBe("2026-07-20T19:30:00.000Z");
  });

  it("respeta el horario de verano en una fecha de verano (America/New_York, EDT = UTC-4)", () => {
    const utc = toUtcInstant("2026-07-20", "14:30", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-20T18:30:00.000Z");
  });

  it("respeta el horario estándar en una fecha de invierno (America/New_York, EST = UTC-5)", () => {
    const utc = toUtcInstant("2026-01-20", "14:30", "America/New_York");
    expect(utc.toISOString()).toBe("2026-01-20T19:30:00.000Z");
  });
});

describe("toBusinessLocalTime + formatInBusinessTimezone", () => {
  it("hace el viaje de ida y vuelta: local -> UTC -> local", () => {
    const utc = toUtcInstant("2026-07-20", "09:00", "America/Bogota");
    const local = toBusinessLocalTime(utc, "America/Bogota");
    expect(local.getHours()).toBe(9);
  });

  it("formatea el mismo instante distinto según la zona horaria del negocio", () => {
    const utc = toUtcInstant("2026-07-20", "12:00", "America/Bogota");
    expect(formatInBusinessTimezone(utc, "America/Bogota", "HH:mm")).toBe("12:00");
    // Bogotá es UTC-5 todo el año; Nueva York en julio es UTC-4 (EDT) — 1h más tarde.
    expect(formatInBusinessTimezone(utc, "America/New_York", "HH:mm")).toBe("13:00");
  });
});
