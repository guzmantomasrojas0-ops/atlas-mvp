import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "@/modules/auth/domain";

describe("generateSessionToken", () => {
  it("genera tokens distintos en cada llamada", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateSessionToken()));
    expect(tokens.size).toBe(20);
  });

  it("genera un token hexadecimal de 64 caracteres (32 bytes)", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashSessionToken", () => {
  it("es determinístico: el mismo token siempre produce el mismo hash", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("el hash nunca es igual al token original", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("tokens distintos producen hashes distintos", () => {
    const tokenA = generateSessionToken();
    const tokenB = generateSessionToken();
    expect(hashSessionToken(tokenA)).not.toBe(hashSessionToken(tokenB));
  });
});
