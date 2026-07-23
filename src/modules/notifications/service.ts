import { logger } from "@/lib/logger";
import { WhatsAppAdapter, type MessageSender } from "@/modules/messaging";
import { computeDueNotifications, composeNotificationMessage } from "./domain";
import type { ExistingNotificationRecord } from "./domain";
import {
  claimNotificationAttempt,
  findCandidateAppointments,
  findExistingNotificationsForAppointments,
  markNotificationFailed,
  markNotificationSent,
  markNotificationSkipped,
} from "./data";

export interface NotificationRunSummary {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Corre una pasada del scheduler: busca citas candidatas, decide qué
 * notificaciones corresponden ahora (`computeDueNotifications`), y las
 * envía. `sender` es inyectable a propósito — en producción se resuelve un
 * `WhatsAppAdapter` real recién acá (nunca antes), y los tests pueden pasar
 * cualquier `MessageSender` falso sin tocar credenciales ni la red.
 */
export async function runDueNotifications(
  business: { id: string; name: string; timezone: string },
  now: Date,
  sender?: MessageSender,
): Promise<NotificationRunSummary> {
  const resolvedSender = sender ?? new WhatsAppAdapter();
  const summary: NotificationRunSummary = { sent: 0, failed: 0, skipped: 0 };

  const candidates = await findCandidateAppointments(business.id, now);
  const existingByAppointment = groupByAppointment(
    await findExistingNotificationsForAppointments(candidates.map((appointment) => appointment.id)),
  );

  for (const appointment of candidates) {
    const existing = existingByAppointment.get(appointment.id) ?? [];
    const due = computeDueNotifications(now, appointment, existing);

    for (const item of due) {
      const record = await claimNotificationAttempt(
        business.id,
        appointment.id,
        item.type,
        item.targetAt,
      );

      if (!appointment.client.phone) {
        await markNotificationSkipped(record.id, "El cliente no tiene teléfono registrado.", now);
        summary.skipped++;
        continue;
      }

      const text = composeNotificationMessage(
        item.type,
        {
          id: appointment.id,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          clientName: appointment.client.name,
          clientPhone: appointment.client.phone,
          staffName: appointment.staff.name,
          serviceName: appointment.service.name,
        },
        business.name,
        business.timezone,
      );

      try {
        const result = await resolvedSender.send(appointment.client.phone, {
          text,
          attachments: [],
          metadata: {},
        });

        if (result.success) {
          await markNotificationSent(record.id, now);
          summary.sent++;
        } else {
          const attemptCount = record.attemptCount + 1;
          logger.error(
            { appointmentId: appointment.id, type: item.type, error: result.error },
            "No se pudo enviar la notificación.",
          );
          await markNotificationFailed(
            record.id,
            attemptCount,
            result.error ?? "Error desconocido.",
            now,
          );
          summary.failed++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          { appointmentId: appointment.id, type: item.type, error: message },
          "Excepción inesperada enviando la notificación.",
        );
        await markNotificationFailed(record.id, record.attemptCount + 1, message, now);
        summary.failed++;
      }
    }
  }

  return summary;
}

type ExistingNotificationRow = Awaited<
  ReturnType<typeof findExistingNotificationsForAppointments>
>[number];

/** Agrupa las filas de una sola consulta `IN` por cita — lo que le permite al loop de arriba no volver a pegarle a la base por cada candidata. */
function groupByAppointment(
  rows: ExistingNotificationRow[],
): Map<string, ExistingNotificationRecord[]> {
  const map = new Map<string, ExistingNotificationRecord[]>();
  for (const row of rows) {
    const list = map.get(row.appointmentId) ?? [];
    list.push(row);
    map.set(row.appointmentId, list);
  }
  return map;
}
