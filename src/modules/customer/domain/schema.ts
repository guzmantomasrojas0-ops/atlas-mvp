import { z } from "zod";

const phonePattern = /^[0-9+()\-\s]{6,20}$/;

/** Mismo criterio de teléfono que `scheduling/domain/schema.ts` — opcional, pero si viene, debe ser válido. */
export const customerInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || phonePattern.test(value), "Ingresa un teléfono válido"),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
