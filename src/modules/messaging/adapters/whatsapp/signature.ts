import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida que un webhook realmente venga de Meta: recalcula el HMAC-SHA256
 * del body crudo (sin parsear) con el App Secret y lo compara, en tiempo
 * constante, contra el header `X-Hub-Signature-256` (formato
 * "sha256=<hex>"). Debe correr sobre el string crudo del request — parsear
 * el JSON antes de esto invalidaría la firma.
 */
export function isValidMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}
