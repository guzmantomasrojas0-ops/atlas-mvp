import {
  MAX_NOTIFICATION_ATTEMPTS,
  type DueNotification,
  type ExistingNotificationRecord,
  type NotificationType,
} from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * Calcula, para una cita CONFIRMADA, qué notificaciones corresponde disparar
 * ahora mismo (`now`). Pura: no toca la base — recibe las filas de
 * `AppointmentNotification` ya existentes para esta cita y decide.
 *
 * `targetAt` de cada tipo se deriva del horario ACTUAL de la cita
 * (`startsAt`/`endsAt`), no de un valor guardado — así, si la cita se
 * reprograma, el `targetAt` de una corrida anterior deja de coincidir con el
 * recién calculado, y la notificación para el horario nuevo se trata como
 * pendiente de nuevo sin que nadie tenga que "resetear" nada explícitamente.
 */
export function computeDueNotifications(
  now: Date,
  appointment: { startsAt: Date; endsAt: Date },
  existing: ExistingNotificationRecord[],
): DueNotification[] {
  const candidates: { type: NotificationType; targetAt: Date }[] = [
    { type: "REMINDER_24H", targetAt: new Date(appointment.startsAt.getTime() - 24 * HOUR) },
    { type: "REMINDER_2H", targetAt: new Date(appointment.startsAt.getTime() - 2 * HOUR) },
    { type: "THANK_YOU", targetAt: appointment.endsAt },
  ];

  const due: DueNotification[] = [];
  for (const candidate of candidates) {
    if (candidate.targetAt.getTime() > now.getTime()) continue;
    // Un recordatorio ya no tiene sentido si la cita ya empezó (o pasó).
    if (candidate.type !== "THANK_YOU" && appointment.startsAt.getTime() <= now.getTime()) continue;

    const record = existing.find(
      (r) => r.type === candidate.type && r.targetAt.getTime() === candidate.targetAt.getTime(),
    );

    if (!record) {
      due.push({ type: candidate.type, targetAt: candidate.targetAt, isRetry: false });
      continue;
    }
    // SENT o SKIPPED ya están resueltos. PENDING (una corrida anterior se
    // interrumpió antes de confirmar el resultado) o FAILED se reintentan
    // hasta el máximo de intentos.
    if (
      (record.status === "FAILED" || record.status === "PENDING") &&
      record.attemptCount < MAX_NOTIFICATION_ATTEMPTS
    ) {
      due.push({ type: candidate.type, targetAt: candidate.targetAt, isRetry: true });
    }
  }
  return due;
}
