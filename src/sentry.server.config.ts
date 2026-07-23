import * as Sentry from "@sentry/nextjs";

// Mismo criterio que instrumentation-client.ts: sin SENTRY_DSN, deshabilitado.
const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 1.0),
});
