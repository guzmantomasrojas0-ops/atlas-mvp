import { createHash, randomBytes } from "node:crypto";

/** Token de sesión: lo único que existe en la cookie del navegador, nunca en la base. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Lo que sí se guarda en `Session.tokenHash` — ver el comentario del modelo en schema.prisma. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
