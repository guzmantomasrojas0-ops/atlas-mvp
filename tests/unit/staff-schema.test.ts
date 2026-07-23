import { describe, expect, it } from "vitest";
import { staffMemberInputSchema } from "@/modules/catalog/domain";

const validInput = {
  name: "Juan Pérez",
  role: "Barbero",
};

describe("staffMemberInputSchema", () => {
  it("acepta un input válido", () => {
    expect(staffMemberInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rechaza un nombre muy corto", () => {
    const result = staffMemberInputSchema.safeParse({ ...validInput, name: "a" });
    expect(result.success).toBe(false);
  });

  it("rechaza un rol muy corto", () => {
    const result = staffMemberInputSchema.safeParse({ ...validInput, role: "a" });
    expect(result.success).toBe(false);
  });

  it("rechaza un nombre vacío", () => {
    const result = staffMemberInputSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("recorta espacios en blanco del nombre y del rol", () => {
    const result = staffMemberInputSchema.safeParse({ name: "  Juan  ", role: "  Barbero  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Juan");
      expect(result.data.role).toBe("Barbero");
    }
  });
});
