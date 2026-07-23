import { BUSINESS_HOURS_END, BUSINESS_HOURS_START, SLOT_MINUTES } from "./constants";
import { getLocalDateAndMinutes, toUtcInstant } from "./timezone";

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

/**
 * ¿Se superponen dos rangos [startsAt, endsAt)? Los bordes que solo se
 * tocan (una reserva termina exactamente cuando empieza la otra) NO cuentan
 * como conflicto — coincide con el operador `&&` de rangos de Postgres que
 * usa el constraint EXCLUDE en la base.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** El primer rango existente que se superpone con el candidato, si hay alguno. */
export function findConflict<T extends TimeRange>(
  candidate: TimeRange,
  existing: T[],
): T | undefined {
  return existing.find((appointment) => rangesOverlap(candidate, appointment));
}

function minutesToHHmm(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

/**
 * ¿El rango [startsAt, endsAt) cae entero dentro de la ventana horaria fija
 * (`BUSINESS_HOURS_START`–`BUSINESS_HOURS_END`)? Nada lo garantizaba hasta
 * ahora: el formulario manual de reservas nunca lo chequeó a nivel de
 * datos, solo lo insinuaba mostrando nada más los horarios de la ventana en
 * su UI — un llamado directo (por ejemplo, desde una Tool del agente) podía
 * agendar a cualquier hora. Se comparte acá para que tanto el flujo manual
 * como el del agente queden protegidos con una sola implementación.
 */
export function isWithinBusinessHours(startsAt: Date, endsAt: Date, timezone: string): boolean {
  const start = getLocalDateAndMinutes(startsAt, timezone);
  const end = getLocalDateAndMinutes(endsAt, timezone);
  if (start.date !== end.date) return false;
  return start.minutes >= BUSINESS_HOURS_START * 60 && end.minutes <= BUSINESS_HOURS_END * 60;
}

/**
 * Genera los horarios libres de un día para un servicio de cierta duración,
 * probando cada slot de `SLOT_MINUTES` dentro de la ventana horaria fija
 * (`BUSINESS_HOURS_START`–`BUSINESS_HOURS_END`, ver constants.ts) y
 * descartando los que chocan con alguna reserva existente. Pura: recibe las
 * reservas ya consultadas, no hace ninguna consulta ella misma.
 */
export function findAvailableSlots(
  date: string,
  timezone: string,
  serviceDurationMinutes: number,
  existingBookings: TimeRange[],
): TimeRange[] {
  const slots: TimeRange[] = [];
  const dayStartMinutes = BUSINESS_HOURS_START * 60;
  const dayEndMinutes = BUSINESS_HOURS_END * 60;

  for (
    let minutes = dayStartMinutes;
    minutes + serviceDurationMinutes <= dayEndMinutes;
    minutes += SLOT_MINUTES
  ) {
    const startsAt = toUtcInstant(date, minutesToHHmm(minutes), timezone);
    const endsAt = new Date(startsAt.getTime() + serviceDurationMinutes * 60_000);
    const candidate: TimeRange = { startsAt, endsAt };

    if (!findConflict(candidate, existingBookings)) {
      slots.push(candidate);
    }
  }

  return slots;
}
