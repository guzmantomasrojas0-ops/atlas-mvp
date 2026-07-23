import { db } from "@/lib/db";

export function createSession(userId: string, tokenHash: string, expiresAt: Date) {
  return db.session.create({ data: { userId, tokenHash, expiresAt } });
}

/** Trae la sesión junto con el usuario y su negocio — lo mínimo que necesita `requireSession()` en una sola consulta. */
export function findSessionByTokenHash(tokenHash: string) {
  return db.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { business: true } } },
  });
}

export function deleteSessionByTokenHash(tokenHash: string) {
  return db.session.deleteMany({ where: { tokenHash } });
}

/** Invalida todas las sesiones de un usuario — no se usa todavía en Sprint 21, pero es la pieza que un futuro "cerrar sesión en todos los dispositivos" necesitaría, sin duplicar la lógica de borrado. */
export function deleteAllSessionsForUser(userId: string) {
  return db.session.deleteMany({ where: { userId } });
}
