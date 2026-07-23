import { describe, expect, it } from "vitest";
import { filterStaffByQuery, findStaffTool, type StaffMatch } from "@/modules/agent";

const STAFF: StaffMatch[] = [
  { id: "st1", name: "Ana Gómez", role: "Barbera" },
  { id: "st2", name: "Beto Ruiz", role: "Barbero" },
];

describe("filterStaffByQuery", () => {
  it("devuelve todo el equipo cuando no hay query", () => {
    expect(filterStaffByQuery(STAFF)).toEqual(STAFF);
  });

  it("filtra por coincidencia parcial de nombre, sin distinguir mayúsculas ni tildes", () => {
    expect(filterStaffByQuery(STAFF, "gomez")).toEqual([STAFF[0]]);
    expect(filterStaffByQuery(STAFF, "BETO")).toEqual([STAFF[1]]);
  });

  it("devuelve una lista vacía cuando nadie matchea", () => {
    expect(filterStaffByQuery(STAFF, "carlos")).toEqual([]);
  });
});

describe("findStaffTool", () => {
  it("declara su nombre", () => {
    expect(findStaffTool.name).toBe("FIND_STAFF");
  });
});
