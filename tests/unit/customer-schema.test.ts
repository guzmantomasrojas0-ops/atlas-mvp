import { describe, expect, it } from "vitest";
import { customerInputSchema } from "@/modules/customer/domain";

const validInput = {
  name: "María Gómez",
  phone: "+57 300 123 4567",
};

describe("customerInputSchema", () => {
  it("acepta un input válido", () => {
    expect(customerInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("acepta un teléfono vacío (opcional en la práctica)", () => {
    const result = customerInputSchema.safeParse({ ...validInput, phone: "" });
    expect(result.success).toBe(true);
  });

  it("rechaza un nombre muy corto", () => {
    const result = customerInputSchema.safeParse({ ...validInput, name: "a" });
    expect(result.success).toBe(false);
  });

  it("rechaza un teléfono con letras", () => {
    const result = customerInputSchema.safeParse({ ...validInput, phone: "no-es-un-telefono" });
    expect(result.success).toBe(false);
  });

  it("recorta espacios en blanco del nombre", () => {
    const result = customerInputSchema.safeParse({ ...validInput, name: "  María Gómez  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("María Gómez");
    }
  });
});
