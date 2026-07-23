import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidMetaSignature } from "@/modules/messaging";

const APP_SECRET = "test-app-secret";

function sign(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("isValidMetaSignature", () => {
  it("acepta una firma válida calculada con el mismo App Secret", () => {
    const rawBody = JSON.stringify({ entry: [] });
    expect(isValidMetaSignature(rawBody, sign(rawBody, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it("rechaza si el body fue alterado después de firmarlo", () => {
    const original = JSON.stringify({ entry: [] });
    const signature = sign(original, APP_SECRET);
    const tampered = JSON.stringify({ entry: [{ id: "inyectado" }] });
    expect(isValidMetaSignature(tampered, signature, APP_SECRET)).toBe(false);
  });

  it("rechaza si se firmó con un App Secret distinto", () => {
    const rawBody = JSON.stringify({ entry: [] });
    const signature = sign(rawBody, "otro-secreto");
    expect(isValidMetaSignature(rawBody, signature, APP_SECRET)).toBe(false);
  });

  it("rechaza si no hay ningún header de firma", () => {
    const rawBody = JSON.stringify({ entry: [] });
    expect(isValidMetaSignature(rawBody, null, APP_SECRET)).toBe(false);
  });

  it("rechaza un header sin el prefijo sha256=", () => {
    const rawBody = JSON.stringify({ entry: [] });
    const hex = createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");
    expect(isValidMetaSignature(rawBody, hex, APP_SECRET)).toBe(false);
  });

  it("rechaza un header con hex inválido o de otra longitud", () => {
    const rawBody = JSON.stringify({ entry: [] });
    expect(isValidMetaSignature(rawBody, "sha256=no-es-hex-valido", APP_SECRET)).toBe(false);
    expect(isValidMetaSignature(rawBody, "sha256=abcd", APP_SECRET)).toBe(false);
  });
});
