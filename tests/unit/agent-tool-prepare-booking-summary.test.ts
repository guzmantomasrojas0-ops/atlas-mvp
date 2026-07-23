import { describe, expect, it } from "vitest";
import { findMatchingSlot, prepareBookingSummaryTool } from "@/modules/agent";
import type { TimeRange } from "@/modules/scheduling";

const SLOTS: TimeRange[] = [
  { startsAt: new Date("2026-07-21T15:00:00.000Z"), endsAt: new Date("2026-07-21T15:30:00.000Z") },
  { startsAt: new Date("2026-07-21T15:30:00.000Z"), endsAt: new Date("2026-07-21T16:00:00.000Z") },
];

describe("findMatchingSlot", () => {
  it("devuelve el slot cuyo inicio coincide exactamente con el horario pedido", () => {
    const requestedStartMs = new Date("2026-07-21T15:30:00.000Z").getTime();
    expect(findMatchingSlot(SLOTS, requestedStartMs)).toBe(SLOTS[1]);
  });

  it("devuelve undefined si ningún slot empieza justo en ese horario", () => {
    const requestedStartMs = new Date("2026-07-21T16:00:00.000Z").getTime();
    expect(findMatchingSlot(SLOTS, requestedStartMs)).toBeUndefined();
  });

  it("devuelve undefined con una lista vacía", () => {
    expect(findMatchingSlot([], Date.now())).toBeUndefined();
  });
});

describe("prepareBookingSummaryTool", () => {
  it("declara su nombre — la lógica real (catálogo + disponibilidad) se testea con Postgres real", () => {
    expect(prepareBookingSummaryTool.name).toBe("PREPARE_BOOKING_SUMMARY");
    expect(typeof prepareBookingSummaryTool.execute).toBe("function");
  });
});
