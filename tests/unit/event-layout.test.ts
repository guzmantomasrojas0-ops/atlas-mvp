import { describe, expect, it } from "vitest";
import { computeEventLayout } from "@/modules/scheduling/domain";

function byId(layout: ReturnType<typeof computeEventLayout>, id: string) {
  const found = layout.find((item) => item.id === id);
  if (!found) throw new Error(`no layout for ${id}`);
  return found;
}

describe("computeEventLayout", () => {
  it("eventos que no se solapan van todos en el carril 0", () => {
    const layout = computeEventLayout([
      { id: "a", startMinutes: 0, endMinutes: 30 },
      { id: "b", startMinutes: 60, endMinutes: 90 },
      { id: "c", startMinutes: 120, endMinutes: 150 },
    ]);
    for (const item of layout) {
      expect(item.lane).toBe(0);
      expect(item.laneCount).toBe(1);
    }
  });

  it("dos eventos que se solapan van en carriles distintos con laneCount 2", () => {
    const layout = computeEventLayout([
      { id: "a", startMinutes: 0, endMinutes: 60 },
      { id: "b", startMinutes: 30, endMinutes: 90 },
    ]);
    expect(byId(layout, "a").lane).not.toBe(byId(layout, "b").lane);
    expect(byId(layout, "a").laneCount).toBe(2);
    expect(byId(layout, "b").laneCount).toBe(2);
  });

  it("un evento que termina justo cuando otro empieza NO cuenta como solapado", () => {
    const layout = computeEventLayout([
      { id: "a", startMinutes: 0, endMinutes: 60 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
    ]);
    expect(byId(layout, "a").lane).toBe(0);
    expect(byId(layout, "b").lane).toBe(0);
    expect(byId(layout, "a").laneCount).toBe(1);
  });

  it("cadena transitiva (A-B solapan, B-C solapan, A-C no) reutiliza el carril de A para C", () => {
    const layout = computeEventLayout([
      { id: "a", startMinutes: 0, endMinutes: 30 },
      { id: "b", startMinutes: 15, endMinutes: 45 },
      { id: "c", startMinutes: 35, endMinutes: 60 },
    ]);
    // A y C conviven en el cluster de B, pero no se solapan entre sí — pueden compartir carril.
    expect(byId(layout, "a").lane).toBe(byId(layout, "c").lane);
    expect(byId(layout, "b").lane).not.toBe(byId(layout, "a").lane);
    expect(byId(layout, "a").laneCount).toBe(2);
  });

  it("clusters independientes (sin ninguna relación) no se contaminan entre sí", () => {
    const layout = computeEventLayout([
      { id: "a", startMinutes: 0, endMinutes: 30 },
      { id: "b", startMinutes: 10, endMinutes: 40 },
      { id: "c", startMinutes: 200, endMinutes: 230 },
    ]);
    expect(byId(layout, "a").laneCount).toBe(2);
    expect(byId(layout, "c").laneCount).toBe(1);
  });

  it("lista vacía devuelve lista vacía", () => {
    expect(computeEventLayout([])).toEqual([]);
  });
});
