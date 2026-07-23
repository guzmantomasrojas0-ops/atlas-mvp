import { describe, expect, it } from "vitest";
import { createOwnerAccountInputSchema, loginInputSchema } from "@/modules/auth/domain";

describe("loginInputSchema", () => {
  it("acepta un correo y contraseña válidos", () => {
    expect(
      loginInputSchema.safeParse({ email: "ana@example.com", password: "cualquiera" }).success,
    ).toBe(true);
  });

  it("normaliza el correo a minúsculas y sin espacios", () => {
    const parsed = loginInputSchema.parse({ email: "  Ana@EXAMPLE.com  ", password: "x" });
    expect(parsed.email).toBe("ana@example.com");
  });

  it("rechaza un correo inválido", () => {
    expect(loginInputSchema.safeParse({ email: "no-es-un-correo", password: "x" }).success).toBe(
      false,
    );
  });

  it("rechaza una contraseña vacía", () => {
    expect(loginInputSchema.safeParse({ email: "ana@example.com", password: "" }).success).toBe(
      false,
    );
  });
});

describe("createOwnerAccountInputSchema", () => {
  const valid = { email: "ana@example.com", password: "contraseña-larga", name: "Ana Gómez" };

  it("acepta datos válidos", () => {
    expect(createOwnerAccountInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rechaza una contraseña de menos de 8 caracteres", () => {
    expect(createOwnerAccountInputSchema.safeParse({ ...valid, password: "corta" }).success).toBe(
      false,
    );
  });

  it("rechaza un nombre muy corto", () => {
    expect(createOwnerAccountInputSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("no acepta un campo role (esta cuenta siempre es OWNER)", () => {
    const parsed = createOwnerAccountInputSchema.parse({ ...valid, role: "STAFF" });
    expect(parsed).not.toHaveProperty("role");
  });
});
