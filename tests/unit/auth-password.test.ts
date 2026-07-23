import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/modules/auth/domain";

describe("hashPassword / verifyPassword", () => {
  it("un hash verifica correctamente contra su contraseña original", async () => {
    const hash = await hashPassword("super-secreta-123");
    expect(await verifyPassword("super-secreta-123", hash)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("super-secreta-123");
    expect(await verifyPassword("otra-cosa", hash)).toBe(false);
  });

  it("el hash nunca contiene la contraseña en texto plano", async () => {
    const hash = await hashPassword("super-secreta-123");
    expect(hash).not.toContain("super-secreta-123");
  });

  it("dos hashes de la misma contraseña son distintos (salt aleatorio)", async () => {
    const hashA = await hashPassword("misma-contraseña");
    const hashB = await hashPassword("misma-contraseña");
    expect(hashA).not.toBe(hashB);
    expect(await verifyPassword("misma-contraseña", hashA)).toBe(true);
    expect(await verifyPassword("misma-contraseña", hashB)).toBe(true);
  });
});
