import type { Role } from "./types";

/**
 * Las reglas de "quién puede qué" viven acá, en un solo lugar — el mecanismo
 * que las hace cumplir (leer la sesión, redirigir/rechazar) vive en
 * `lib/session.ts`. Separar la regla del mecanismo es lo que evita que cada
 * Server Action reimplemente su propia versión de "solo el dueño puede...".
 */
export function canManagePayments(role: Role): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageCatalog(role: Role): boolean {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageUsers(role: Role): boolean {
  return role === "OWNER";
}
