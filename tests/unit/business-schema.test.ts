import { describe, expect, it } from "vitest";
import { businessInputSchema } from "@/modules/business/domain";

const validInput = {
  name: "Barbería Test",
  phone: "+57 300 123 4567",
  address: "Calle 45 #12-30",
  timezone: "America/Bogota",
  businessType: "BARBERSHOP" as const,
};

describe("businessInputSchema", () => {
  it("acepta un input válido", () => {
    expect(businessInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rechaza un nombre muy corto", () => {
    const result = businessInputSchema.safeParse({ ...validInput, name: "a" });
    expect(result.success).toBe(false);
  });

  it("rechaza un teléfono con letras", () => {
    const result = businessInputSchema.safeParse({ ...validInput, phone: "abc" });
    expect(result.success).toBe(false);
  });

  it("rechaza una zona horaria que no existe", () => {
    const result = businessInputSchema.safeParse({ ...validInput, timezone: "Not/AZone" });
    expect(result.success).toBe(false);
  });

  it("rechaza un tipo de negocio fuera del enum soportado", () => {
    const result = businessInputSchema.safeParse({ ...validInput, businessType: "SPA" });
    expect(result.success).toBe(false);
  });

  it("recorta espacios en blanco en los campos de texto", () => {
    const result = businessInputSchema.safeParse({ ...validInput, name: "  Barbería  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Barbería");
    }
  });
});
