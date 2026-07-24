import * as Sentry from "@sentry/nextjs";

/**
 * Hook de registro nativo de Next.js (no específico de Sentry) — corre una
 * vez al arrancar el server, antes de servir requests.
 *
 * Deliberadamente NO se inicializa Sentry para el runtime Edge (donde corre
 * src/middleware.ts). Se probó (ver docs/operations/MONITORING.md) y costaba
 * ~65 kB extra en CADA request a /dashboard/* — el bundle de Middleware pasó
 * de 34 kB a 99 kB — a cambio de instrumentar una función de 6 líneas (chequear
 * si existe una cookie y redirigir) que no tiene ninguna lógica que pueda
 * fallar de forma interesante. El costo no se justificaba con el beneficio,
 * así que se sacó — no fue un descuido, fue una decisión revertida a propósito.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/**
 * Captura errores no manejados de Server Components, Route Handlers y
 * Server Actions que de otra forma no pasan por src/lib/logger.ts (esos ya
 * quedan cubiertos porque logger.error/fatal llaman a Sentry.captureException
 * directamente — ver logger.ts). Esto es la red que falta para lo que ningún
 * try/catch explícito atrapó.
 */
export const onRequestError = Sentry.captureRequestError;
