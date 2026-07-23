import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const phonePattern = /^[0-9+()\-\s]{6,20}$/;

export const appointmentInputSchema = z.object({
  staffId: z.string().min(1, "Seleccioná un miembro del equipo"),
  serviceId: z.string().min(1, "Seleccioná un servicio"),
  clientName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  clientPhone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || phonePattern.test(value), "Ingresá un teléfono válido"),
  date: z.string().regex(datePattern, "Seleccioná una fecha"),
  time: z.string().regex(timePattern, "Seleccioná un horario"),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

export const rescheduleAppointmentInputSchema = z.object({
  date: z.string().regex(datePattern, "Seleccioná una fecha"),
  time: z.string().regex(timePattern, "Seleccioná un horario"),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentInputSchema>;
