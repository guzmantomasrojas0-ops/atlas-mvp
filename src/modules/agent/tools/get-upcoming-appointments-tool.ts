import { z } from "zod";
import { getAppointmentsByClient } from "@/modules/scheduling";
import type { Tool } from "../domain";

export const getUpcomingAppointmentsInputSchema = z.object({
  businessId: z.string().min(1),
  clientId: z.string().min(1),
  /** Instante de referencia para "próximas" — inyectable para tests, por defecto ahora. */
  now: z.date().optional(),
});

export type GetUpcomingAppointmentsInput = z.infer<typeof getUpcomingAppointmentsInputSchema>;

export interface UpcomingAppointment {
  id: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
}

export interface GetUpcomingAppointmentsOutput {
  appointments: UpcomingAppointment[];
}

/**
 * Se queda solo con las reservas futuras respecto a `now`, ordenadas de la
 * más cercana a la más lejana. Pura — separada de `execute` para poder
 * testearla sin tocar la base.
 */
export function selectUpcomingAppointments(
  appointments: UpcomingAppointment[],
  now: Date,
): UpcomingAppointment[] {
  return appointments
    .filter((appointment) => appointment.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Consulta las próximas reservas confirmadas de un cliente, ordenadas de la más cercana a la más lejana. */
export const getUpcomingAppointmentsTool: Tool<
  GetUpcomingAppointmentsInput,
  GetUpcomingAppointmentsOutput
> = {
  name: "GET_UPCOMING_APPOINTMENTS",
  description: "Consulta las próximas reservas confirmadas de un cliente puntual.",
  inputSchema: getUpcomingAppointmentsInputSchema,
  async execute(input) {
    const now = input.now ?? new Date();
    const appointments = await getAppointmentsByClient(input.businessId, input.clientId);
    return { appointments: selectUpcomingAppointments(appointments, now) };
  },
};
