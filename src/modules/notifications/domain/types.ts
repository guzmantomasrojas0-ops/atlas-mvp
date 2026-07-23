export type NotificationType = "REMINDER_24H" | "REMINDER_2H" | "THANK_YOU";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

/** Máximo de intentos para una notificación en FAILED/PENDING antes de dejar de reintentarla. */
export const MAX_NOTIFICATION_ATTEMPTS = 3;

export interface NotifiableAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  clientName: string;
  clientPhone: string | null;
  staffName: string;
  serviceName: string;
}

/** Una fila `AppointmentNotification` ya existente, tal como la necesita la lógica de "qué está pendiente". */
export interface ExistingNotificationRecord {
  type: NotificationType;
  targetAt: Date;
  status: NotificationStatus;
  attemptCount: number;
}

/** Una notificación que corresponde disparar (o reintentar) en esta corrida. */
export interface DueNotification {
  type: NotificationType;
  targetAt: Date;
  isRetry: boolean;
}
