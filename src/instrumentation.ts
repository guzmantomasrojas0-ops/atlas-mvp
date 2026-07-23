import * as Sentry from "@sentry/nextjs";

/**
 * Hook de registro nativo de Next.js (no específico de Sentry) — corre una
 * vez al arrancar el server, antes de servir requests. Cada runtime (Node
 * vs Edge, ver src/middleware.ts) necesita su propia inicialización de
 * Sentry porque no comparten proceso.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
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
