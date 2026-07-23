import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeText } from "@/modules/agent/domain";

describe("normalizeText", () => {
  it("pasa todo a minúsculas", () => {
    expect(normalizeText("CORTE DE PELO")).toBe("corte de pelo");
  });

  it("quita tildes", () => {
    expect(normalizeText("María Gómez")).toBe("maria gomez");
    expect(normalizeText("¿Atención los sábados?")).toBe("¿atencion los sabados?");
  });
});

describe("matchesQuery", () => {
  it("matchea una substring exacta", () => {
    expect(matchesQuery("Corte de pelo", "corte")).toBe(true);
  });

  it("ignora mayúsculas y tildes en ambos lados", () => {
    expect(matchesQuery("María Gómez", "GOMEZ")).toBe(true);
    expect(matchesQuery("Ana Gómez", "gómez")).toBe(true);
  });

  it("es una búsqueda parcial, no exige coincidencia completa", () => {
    expect(matchesQuery("Corte y barba", "barba")).toBe(true);
    expect(matchesQuery("Corte y barba", "y")).toBe(true);
  });

  it("devuelve false cuando no hay coincidencia", () => {
    expect(matchesQuery("Corte de pelo", "manicura")).toBe(false);
  });

  it("una query vacía matchea cualquier texto", () => {
    expect(matchesQuery("Corte de pelo", "")).toBe(true);
  });
});
