import * as Sentry from "@sentry/nextjs";

// Sin NEXT_PUBLIC_SENTRY_DSN, `Sentry.init` queda deshabilitado (no manda
// nada, no rompe nada) — así el proyecto corre igual en local/CI sin cuenta
// de Sentry. Ver docs/operations/MONITORING.md para cómo activarlo.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // 100% en desarrollo (barato, útil para verificar la integración);
  // en producción bajarlo con NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE (ej.
  // "0.1") una vez que haya tráfico real — ver MONITORING.md.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 1.0),
  // Sin session replay: el dashboard maneja datos de negocios reales
  // (nombres de clientes, teléfonos, contenido de conversaciones) y grabar
  // sesiones de pantalla sería un vector de exposición de PII innecesario
  // para lo que este proyecto necesita de Sentry (errores, no UX analytics).
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
