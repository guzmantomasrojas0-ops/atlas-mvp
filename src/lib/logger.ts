import pino from "pino";
import * as Sentry from "@sentry/nextjs";

const pinoLogger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

type LogArgs = [obj: object, msg: string] | [msg: string];

/**
 * Todo `logger.error`/`logger.fatal` de la app pasa también por acá — así los
 * puntos que ya logueaban errores reales (fallos de WhatsApp, del Agente, del
 * cron, de notificaciones — ver grep de `logger.error` en el repo) quedan
 * reportados a Sentry sin tener que tocar cada call site. Sin SENTRY_DSN
 * configurado, `Sentry.captureException`/`captureMessage` son no-ops (ver
 * sentry.server.config.ts) — no hay comportamiento condicional acá.
 */
function reportToSentry(args: LogArgs) {
  const [first, second] = args;

  if (typeof first === "object" && first !== null) {
    const extra: Record<string, unknown> = { ...first };
    const maybeError = extra.error;
    if (maybeError instanceof Error) {
      Sentry.captureException(maybeError, { extra });
      return;
    }
    Sentry.captureMessage(second ?? "Error sin mensaje", { level: "error", extra });
    return;
  }

  Sentry.captureMessage(first, { level: "error" });
}

export const logger = {
  info: (...args: LogArgs) => pinoLogger.info(...(args as Parameters<typeof pinoLogger.info>)),
  warn: (...args: LogArgs) => pinoLogger.warn(...(args as Parameters<typeof pinoLogger.warn>)),
  error: (...args: LogArgs) => {
    reportToSentry(args);
    return pinoLogger.error(...(args as Parameters<typeof pinoLogger.error>));
  },
  fatal: (...args: LogArgs) => {
    reportToSentry(args);
    return pinoLogger.fatal(...(args as Parameters<typeof pinoLogger.fatal>));
  },
};
