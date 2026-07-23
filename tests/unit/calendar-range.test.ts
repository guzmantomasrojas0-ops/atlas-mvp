import { describe, expect, it } from "vitest";
import {
  addDays,
  formatCalendarRangeLabel,
  getCalendarRange,
  startOfWeekIso,
} from "@/modules/scheduling/domain";

describe("addDays", () => {
  it("suma días dentro del mismo mes", () => {
    expect(addDays("2026-07-20", 3)).toBe("2026-07-23");
  });

  it("resta días cruzando el mes", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("suma días cruzando el año", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("startOfWeekIso", () => {
  it("un lunes es el inicio de su propia semana", () => {
    expect(startOfWeekIso("2026-07-20")).toBe("2026-07-20");
  });

  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    expect(startOfWeekIso("2026-07-26")).toBe("2026-07-20");
  });

  it("un miércoles retrocede al lunes de esa semana", () => {
    expect(startOfWeekIso("2026-07-22")).toBe("2026-07-20");
  });
});

describe("getCalendarRange", () => {
  it("día: cubre exactamente 24 horas en la zona horaria del negocio", () => {
    const { rangeStart, rangeEnd } = getCalendarRange("day", "2026-07-20", "America/Bogota");
    expect(rangeStart.toISOString()).toBe("2026-07-20T05:00:00.000Z");
    expect(rangeEnd.toISOString()).toBe("2026-07-21T05:00:00.000Z");
  });

  it("semana: va de lunes 00:00 a el lunes siguiente 00:00", () => {
    const { rangeStart, rangeEnd } = getCalendarRange("week", "2026-07-22", "America/Bogota");
    expect(rangeStart.toISOString()).toBe("2026-07-20T05:00:00.000Z");
    expect(rangeEnd.toISOString()).toBe("2026-07-27T05:00:00.000Z");
  });
});

describe("formatCalendarRangeLabel", () => {
  it("día: nombre del día capitalizado + fecha completa", () => {
    expect(formatCalendarRangeLabel("day", "2026-07-20")).toBe("Lunes 20 de julio de 2026");
  });

  it("semana dentro del mismo mes: rango de días compacto", () => {
    expect(formatCalendarRangeLabel("week", "2026-07-22")).toBe("20 – 26 de julio de 2026");
  });

  it("semana que cruza dos meses: menciona ambos meses", () => {
    // 2026-07-29 es miércoles; esa semana ISO va del 27/jul al 02/ago.
    expect(formatCalendarRangeLabel("week", "2026-07-29")).toBe(
      "27 de julio – 2 de agosto de 2026",
    );
  });
});
