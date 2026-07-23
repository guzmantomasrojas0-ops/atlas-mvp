import { z } from "zod";

export const PAYMENT_METHODS = ["ZELLE"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<PaymentMethodValue, string> = {
  ZELLE: "Zelle",
};

export const confirmPaymentInputSchema = z.object({
  amount: z
    .number({ message: "Ingresá un monto válido" })
    .positive("El monto debe ser mayor a 0")
    .max(99999999.99, "El monto es demasiado alto"),
  currency: z.string().trim().min(1).max(10).default("USD"),
  method: z.enum(PAYMENT_METHODS).default("ZELLE"),
  notes: z.string().trim().max(500).optional(),
  confirmedBy: z
    .string()
    .trim()
    .min(2, "Ingresá quién confirmó el pago")
    .max(120, "El nombre es demasiado largo"),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentInputSchema>;

/** Estado del registro de pago en sí — nunca es input de un formulario, así que no lleva Zod. */
export type PaymentRecordStatusValue = "CONFIRMED" | "REVERTED";
