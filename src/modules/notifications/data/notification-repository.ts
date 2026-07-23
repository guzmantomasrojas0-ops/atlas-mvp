import { db } from "@/lib/db";
import type { NotificationType } from "../domain";

const HOUR = 60 * 60 * 1000;

/**
 * Candidatas: citas CONFIRMADAS cuya ventana de recordatorio/agradecimiento
 * ya pudo haber llegado. La ventana es amplia a propósito (±24h) para no
 * perder ninguna corrida donde el scheduler haya tardado en ejecutarse, sin
 * escanear la tabla entera en cada corrida.
 */
export function findCandidateAppointments(businessId: string, now: Date) {
  return db.appointment.findMany({
    where: {
      businessId,
      status: "CONFIRMED",
      startsAt: { lte: new Date(now.getTime() + 24 * HOUR) },
      endsAt: { gte: new Date(now.getTime() - 24 * HOUR) },
    },
    include: { client: true, staff: true, service: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Trae las notificaciones ya existentes para TODAS las citas candidatas en
 * una sola consulta (`IN`), en vez de una consulta por cita — evitar ese N+1
 * es lo que le permite a `runDueNotifications` seguir siendo rápido aunque
 * la ventana de candidatas crezca.
 */
export function findExistingNotificationsForAppointments(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return Promise.resolve([]);
  return db.appointmentNotification.findMany({
    where: { appointmentId: { in: appointmentIds } },
  });
}

/**
 * Registra (o recupera, si ya existe por un reintento) el intento para este
 * `(appointmentId, type, targetAt)`. El `@@unique` es lo que hace que esto
 * sea seguro de llamar más de una vez para el mismo disparo.
 */
export function claimNotificationAttempt(
  businessId: string,
  appointmentId: string,
  type: NotificationType,
  targetAt: Date,
) {
  return db.appointmentNotification.upsert({
    where: { appointmentId_type_targetAt: { appointmentId, type, targetAt } },
    create: { businessId, appointmentId, type, targetAt, status: "PENDING", attemptCount: 0 },
    update: {},
  });
}

export function markNotificationSent(id: string, sentAt: Date) {
  return db.appointmentNotification.update({
    where: { id },
    data: { status: "SENT", sentAt, lastAttemptAt: sentAt, lastError: null },
  });
}

export function markNotificationFailed(
  id: string,
  attemptCount: number,
  error: string,
  attemptedAt: Date,
) {
  return db.appointmentNotification.update({
    where: { id },
    data: { status: "FAILED", attemptCount, lastError: error, lastAttemptAt: attemptedAt },
  });
}

export function markNotificationSkipped(id: string, reason: string, attemptedAt: Date) {
  return db.appointmentNotification.update({
    where: { id },
    data: { status: "SKIPPED", lastError: reason, lastAttemptAt: attemptedAt },
  });
}
