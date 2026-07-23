import { z } from "zod";
import { searchAvailability, type StaffAvailability } from "@/modules/scheduling";
import type { Tool } from "../domain";

export const searchAvailabilityInputSchema = z.object({
  businessId: z.string().min(1),
  businessTimezone: z.string().min(1),
  /** Fecha local del negocio, formato "YYYY-MM-DD". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (se espera YYYY-MM-DD)."),
  serviceDurationMinutes: z.number().int().positive(),
  /** Si se omite, devuelve la disponibilidad de todo el equipo. */
  staffId: z.string().min(1).optional(),
});

export type SearchAvailabilityInput = z.infer<typeof searchAvailabilityInputSchema>;

export interface SearchAvailabilityOutput {
  date: string;
  availability: StaffAvailability[];
}

/**
 * Consulta horarios libres para un servicio en una fecha puntual. Delgado
 * a propósito: toda la lógica real (ventana horaria, choque contra
 * reservas existentes) vive en `scheduling`, este tool solo la expone bajo
 * la interfaz `Tool` — no duplica ninguna consulta.
 */
export const searchAvailabilityTool: Tool<SearchAvailabilityInput, SearchAvailabilityOutput> = {
  name: "SEARCH_AVAILABILITY",
  description:
    "Busca horarios libres para un servicio en una fecha puntual, opcionalmente acotado a un miembro del equipo.",
  inputSchema: searchAvailabilityInputSchema,
  async execute(input) {
    const availability = await searchAvailability(
      input.businessId,
      input.businessTimezone,
      input.date,
      input.serviceDurationMinutes,
      input.staffId,
    );
    return { date: input.date, availability };
  },
};
