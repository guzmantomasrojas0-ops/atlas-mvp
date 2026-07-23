import { describe, expect, it } from "vitest";
import { filterServicesByQuery, findServiceTool, type ServiceMatch } from "@/modules/agent";

const SERVICES: ServiceMatch[] = [
  { id: "s1", name: "Corte de pelo", price: 25000, durationMinutes: 30 },
  { id: "s2", name: "Corte y barba", price: 38000, durationMinutes: 45 },
  { id: "s3", name: "Manicura", price: 15000, durationMinutes: 40 },
];

describe("filterServicesByQuery", () => {
  it("devuelve todos los servicios cuando no hay query", () => {
    expect(filterServicesByQuery(SERVICES)).toEqual(SERVICES);
  });

  it("filtra por coincidencia parcial de nombre, sin distinguir mayúsculas ni tildes", () => {
    expect(filterServicesByQuery(SERVICES, "corte")).toEqual([SERVICES[0], SERVICES[1]]);
    expect(filterServicesByQuery(SERVICES, "MANICURA")).toEqual([SERVICES[2]]);
  });

  it("devuelve una lista vacía cuando nada matchea", () => {
    expect(filterServicesByQuery(SERVICES, "pedicura")).toEqual([]);
  });
});

describe("findServiceTool", () => {
  it("declara su nombre y no ejecuta nada hasta que se llame execute()", () => {
    expect(findServiceTool.name).toBe("FIND_SERVICE");
    expect(typeof findServiceTool.execute).toBe("function");
  });
});
