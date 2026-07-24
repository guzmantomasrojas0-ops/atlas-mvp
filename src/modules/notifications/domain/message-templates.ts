import { es } from "date-fns/locale";
import { formatInBusinessTimezone } from "@/modules/scheduling/domain";
import type { NotifiableAppointment, NotificationType } from "./types";

/** Compone el texto de cada tipo de notificación. Pura — el envío en sí vive en `service.ts`. */
export function composeNotificationMessage(
  type: NotificationType,
  appointment: NotifiableAppointment,
  businessName: string,
  businessTimezone: string,
): string {
  const time = formatInBusinessTimezone(appointment.startsAt, businessTimezone, "HH:mm");
  const dateLabel = formatInBusinessTimezone(
    appointment.startsAt,
    businessTimezone,
    "EEEE d 'de' MMMM",
    {
      locale: es,
    },
  );

  switch (type) {
    case "REMINDER_24H":
      return (
        `Hola ${appointment.clientName}! Te recordamos tu cita de ${appointment.serviceName} ` +
        `el ${dateLabel} a las ${time} con ${appointment.staffName} en ${businessName}. ` +
        `Si necesitas reprogramar o cancelar, avísanos.`
      );
    case "REMINDER_2H":
      return (
        `Hola ${appointment.clientName}! Tu cita de ${appointment.serviceName} es hoy a las ${time} ` +
        `con ${appointment.staffName}. ¡Te esperamos en ${businessName}!`
      );
    case "THANK_YOU":
      return (
        `¡Gracias por visitarnos, ${appointment.clientName}! Esperamos que hayas disfrutado tu ` +
        `${appointment.serviceName} con ${appointment.staffName}. Te esperamos pronto en ${businessName}.`
      );
  }
}
