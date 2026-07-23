import * as Sentry from "@sentry/nextjs";

// El middleware (src/middleware.ts) corre en el runtime Edge, que no
// comparte el proceso Node del resto del servidor — necesita su propia
// inicialización de Sentry, separada de sentry.server.config.ts.
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 1.0),
});
