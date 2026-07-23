import { describe, expect, it } from "vitest";
import { serviceInputSchema } from "@/modules/catalog/domain";

const validInput = {
  name: "Corte de pelo",
  price: 25000,
  durationMinutes: 45,
};

describe("serviceInputSchema", () => {
  it("acepta un input válido", () => {
    expect(serviceInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rechaza un nombre muy corto", () => {
    const result = serviceInputSchema.safeParse({ ...validInput, name: "a" });
    expect(result.success).toBe(false);
  });

  it("rechaza un precio negativo o cero", () => {
    expect(serviceInputSchema.safeParse({ ...validInput, price: 0 }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...validInput, price: -10 }).success).toBe(false);
  });

  it("rechaza un precio que no es número", () => {
    const result = serviceInputSchema.safeParse({ ...validInput, price: Number.NaN });
    expect(result.success).toBe(false);
  });

  it("rechaza una duración no entera", () => {
    const result = serviceInputSchema.safeParse({ ...validInput, durationMinutes: 45.5 });
    expect(result.success).toBe(false);
  });

  it("rechaza una duración mayor a 1440 minutos", () => {
    const result = serviceInputSchema.safeParse({ ...validInput, durationMinutes: 1441 });
    expect(result.success).toBe(false);
  });

  it("rechaza una duración negativa o cero", () => {
    expect(serviceInputSchema.safeParse({ ...validInput, durationMinutes: 0 }).success).toBe(false);
  });

  it("recorta espacios en blanco del nombre", () => {
    const result = serviceInputSchema.safeParse({ ...validInput, name: "  Corte  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Corte");
    }
  });
});
