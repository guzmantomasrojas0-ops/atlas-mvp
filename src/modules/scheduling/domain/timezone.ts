import type { Locale } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Combina una fecha local ("2026-07-20") y una hora local ("14:30")
 * interpretadas en la zona horaria del negocio, y devuelve el instante UTC
 * correspondiente. Nunca construyas un `Date` a partir de estos strings sin
 * pasar por acá — `new Date("2026-07-20T14:30:00")` se interpreta en la
 * zona horaria del servidor/navegador, no la del negocio, y produce el bug
 * de horario incorrecto que PLAN.md marca como riesgo técnico.
 */
export function toUtcInstant(date: string, time: string, timezone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

/** Lleva un instante UTC a la hora local del negocio, para mostrarlo o calcularlo. */
export function toBusinessLocalTime(instant: Date, timezone: string): Date {
  return toZonedTime(instant, timezone);
}

/** Formatea un instante UTC en la zona horaria del negocio (ej. "14:30"). */
export function formatInBusinessTimezone(
  instant: Date,
  timezone: string,
  pattern: string,
  options?: { locale?: Locale },
): string {
  return formatInTimeZone(instant, timezone, pattern, options);
}

/** La fecha de "hoy" ("YYYY-MM-DD") tal como se ve en la zona horaria del negocio. */
export function todayInTimezone(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export interface LocalDateAndMinutes {
  date: string;
  minutes: number;
}

/**
 * Descompone un instante UTC en su fecha local ("YYYY-MM-DD") y minutos
 * desde la medianoche, en la zona horaria del negocio — lo que necesita el
 * grid del calendario para ubicar cada reserva en la columna/fila correcta.
 */
export function getLocalDateAndMinutes(instant: Date, timezone: string): LocalDateAndMinutes {
  const date = formatInTimeZone(instant, timezone, "yyyy-MM-dd");
  const [hours, minutes] = formatInTimeZone(instant, timezone, "HH:mm").split(":").map(Number);
  return { date, minutes: hours * 60 + minutes };
}
