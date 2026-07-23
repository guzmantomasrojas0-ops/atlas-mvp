/** Ventanas de tiempo que el dashboard de analytics sabe resolver. */
export type AnalyticsPeriod = "7d" | "30d" | "90d";

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = ["7d", "30d", "90d"];

export const analyticsPeriodLabels: Record<AnalyticsPeriod, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
};

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Traduce un período a un rango [start, end) absoluto en UTC, terminando en
 * `now`. Puro: no lee la base ni el reloj — recibe `now` para ser testeable y
 * para que todas las consultas de una misma corrida usen exactamente el mismo
 * instante de corte.
 */
export function resolvePeriodRange(period: AnalyticsPeriod, now: Date): DateRange {
  const days = PERIOD_DAYS[period];
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end: now };
}

/** Normaliza un string arbitrario (ej. de un query param) a un período válido, con fallback a "30d". */
export function parseAnalyticsPeriod(raw: string | undefined): AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(raw as AnalyticsPeriod) ? (raw as AnalyticsPeriod) : "30d";
}
