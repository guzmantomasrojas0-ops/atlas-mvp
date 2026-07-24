import { z } from "zod";

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  price: z
    .number({ message: "Ingresa un precio válido" })
    .positive("El precio debe ser mayor a 0")
    .max(99999999.99, "El precio es demasiado alto"),
  durationMinutes: z
    .number({ message: "Ingresa una duración válida" })
    .int("La duración debe ser un número entero de minutos")
    .positive("La duración debe ser mayor a 0")
    .max(1440, "La duración no puede superar 1440 minutos (24 horas)"),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const staffMemberInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  role: z.string().trim().min(2, "El rol debe tener al menos 2 caracteres").max(80),
});

export type StaffMemberInput = z.infer<typeof staffMemberInputSchema>;
