import { z } from "zod";
import { createAppointmentForClient } from "@/modules/scheduling";
import type { Tool } from "../domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createAppointmentInputSchema = z.object({
  businessId: z.string().min(1),
  businessTimezone: z.string().min(1),
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  /** Fecha local del negocio, formato "YYYY-MM-DD". */
  date: z.string().regex(datePattern, "Fecha inválida (se espera YYYY-MM-DD)."),
  /** Hora local del negocio, formato "HH:mm". */
  time: z.string().regex(timePattern, "Hora inválida (se espera HH:mm)."),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;

export interface CreateAppointmentOutput {
  appointment: {
    id: string;
    service: { id: string; name: string; price: number; durationMinutes: number };
    staff: { id: string; name: string };
    startsAt: string;
    endsAt: string;
  };
}

/**
 * La primera Tool que escribe datos reales: crea la cita en la agenda del
 * negocio, para el cliente de esta conversación. Nunca confía en nada
 * visto antes en la charla — reutiliza `createAppointmentForClient`
 * (Scheduling), que vuelve a validar todo contra el estado actual de la
 * base (servicio, profesional, horario de atención, conflictos) antes de
 * crear el registro. Si algo cambió desde que se armó el resumen, esta
 * llamada falla con un error estructurado en vez de crear una cita
 * inválida — nunca a medio camino.
 */
export const createAppointmentTool: Tool<CreateAppointmentInput, CreateAppointmentOutput> = {
  name: "CREATE_APPOINTMENT",
  description:
    "Crea la cita real en la agenda del negocio para el cliente de esta conversación, con el servicio, profesional, fecha y hora que ya confirmó.",
  requiresConfirmation: true,
  inputSchema: createAppointmentInputSchema,
  async execute(input) {
    const created = await createAppointmentForClient(input.businessId, input.businessTimezone, {
      clientId: input.clientId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      date: input.date,
      time: input.time,
    });

    return {
      appointment: {
        id: created.id,
        service: created.service,
        staff: created.staff,
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
      },
    };
  },
};
