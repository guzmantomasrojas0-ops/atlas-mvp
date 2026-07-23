import { describe, expect, it } from "vitest";
import { parseAnalyticsPeriod, resolvePeriodRange } from "@/modules/analytics";

const NOW = new Date("2026-07-22T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("resolvePeriodRange", () => {
  it("7d devuelve un rango de exactamente 7 días terminando en now", () => {
    const { start, end } = resolvePeriodRange("7d", NOW);
    expect(end).toEqual(NOW);
    expect(start).toEqual(new Date(NOW.getTime() - 7 * DAY));
  });

  it("30d y 90d devuelven 30 y 90 días", () => {
    expect(resolvePeriodRange("30d", NOW).start).toEqual(new Date(NOW.getTime() - 30 * DAY));
    expect(resolvePeriodRange("90d", NOW).start).toEqual(new Date(NOW.getTime() - 90 * DAY));
  });
});

describe("parseAnalyticsPeriod", () => {
  it("acepta los períodos válidos tal cual", () => {
    expect(parseAnalyticsPeriod("7d")).toBe("7d");
    expect(parseAnalyticsPeriod("30d")).toBe("30d");
    expect(parseAnalyticsPeriod("90d")).toBe("90d");
  });

  it("cae a 30d ante cualquier valor inválido o ausente", () => {
    expect(parseAnalyticsPeriod(undefined)).toBe("30d");
    expect(parseAnalyticsPeriod("")).toBe("30d");
    expect(parseAnalyticsPeriod("todo")).toBe("30d");
    expect(parseAnalyticsPeriod("1y")).toBe("30d");
  });
});
