import { z } from "zod";

export const BUSINESS_TYPES = ["BARBERSHOP", "SALON", "CLINIC", "OTHER"] as const;

export const businessTypeLabels: Record<(typeof BUSINESS_TYPES)[number], string> = {
  BARBERSHOP: "Barbería",
  SALON: "Salón de belleza",
  CLINIC: "Clínica",
  OTHER: "Otro",
};

const supportedTimezones = new Set(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [],
);

export const businessInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{6,20}$/, "Ingresá un teléfono válido"),
  address: z.string().trim().min(4, "La dirección es muy corta").max(200),
  timezone: z.string().refine((tz) => supportedTimezones.has(tz), "Zona horaria inválida"),
  businessType: z.enum(BUSINESS_TYPES, { message: "Seleccioná un tipo de negocio" }),
});

export type BusinessInput = z.infer<typeof businessInputSchema>;
