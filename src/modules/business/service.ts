import { businessInputSchema, type BusinessInput } from "./domain";
import { createBusiness as createBusinessRecord, findFirstBusiness } from "./data";

/**
 * Crea un negocio. Es el punto de entrada real del módulo — valida con Zod
 * acá, no confía en que quien llame ya lo haya hecho.
 */
export async function createBusiness(input: BusinessInput) {
  const data = businessInputSchema.parse(input);
  return createBusinessRecord(data);
}

/**
 * Devuelve el primer negocio creado, si existe. Desde Sprint 21 (auth), esto
 * NO es la forma de resolver "el negocio actual" — eso vive en
 * `getCurrentBusiness()`/`requireSession()` (lib/session.ts), derivado de la
 * sesión autenticada. Esta función solo sirve para los puntos de entrada que
 * por definición no tienen sesión (nadie inició sesión todavía): el
 * bootstrap en `/` (¿ya existe algo, o hay que mostrar el setup?), el
 * webhook de WhatsApp y el cron de notifications (integraciones
 * servidor-a-servidor, sin usuario detrás). Ver el comentario en cada uno.
 */
export function getFirstBusiness() {
  return findFirstBusiness();
}
