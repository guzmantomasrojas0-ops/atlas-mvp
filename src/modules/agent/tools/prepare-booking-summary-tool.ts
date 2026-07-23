import { z } from "zod";
import { getServiceById, getStaffMemberById } from "@/modules/catalog";
import { InvalidReferenceError, searchAvailability, toUtcInstant } from "@/modules/scheduling";
import type { TimeRange } from "@/modules/scheduling";
import type { Tool } from "../domain";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const prepareBookingSummaryInputSchema = z.object({
  businessId: z.string().min(1),
  businessTimezone: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  /** Fecha local del negocio, formato "YYYY-MM-DD". */
  date: z.string().regex(datePattern, "Fecha inválida (se espera YYYY-MM-DD)."),
  /** Hora local del negocio, formato "HH:mm". */
  time: z.string().regex(timePattern, "Hora inválida (se espera HH:mm)."),
});

export type PrepareBookingSummaryInput = z.infer<typeof prepareBookingSummaryInputSchema>;

export interface BookingSummary {
  service: { id: string; name: string; price: number; durationMinutes: number };
  staff: { id: string; name: string };
  date: string;
  time: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  note: string;
}

export interface PrepareBookingSummaryOutput {
  summary: BookingSummary;
}

/** El slot cuyo inicio coincide exactamente con el horario pedido, si hay uno. Pura — testeable sin tocar la base. */
export function findMatchingSlot(
  slots: TimeRange[],
  requestedStartMs: number,
): TimeRange | undefined {
  return slots.find((slot) => slot.startsAt.getTime() === requestedStartMs);
}

/**
 * Arma (nunca guarda) el resumen estructurado de una futura reserva:
 * resuelve servicio y profesional por id reutilizando Catalog, y vuelve a
 * verificar disponibilidad en el momento reutilizando `searchAvailability`
 * de Scheduling — el cliente pudo tardar en confirmar el horario desde que
 * lo vio, así que no se confía en una búsqueda anterior. No crea ninguna
 * reserva ni escribe nada en la base.
 */
export const prepareBookingSummaryTool: Tool<
  PrepareBookingSummaryInput,
  PrepareBookingSummaryOutput
> = {
  name: "PREPARE_BOOKING_SUMMARY",
  description:
    "Arma el resumen estructurado de una reserva (servicio, profesional, fecha, hora) una vez que el cliente ya eligió un horario disponible. Todavía no crea la reserva — solo la resume.",
  inputSchema: prepareBookingSummaryInputSchema,
  async execute(input) {
    const [service, staff] = await Promise.all([
      getServiceById(input.businessId, input.serviceId),
      getStaffMemberById(input.businessId, input.staffId),
    ]);

    if (!service) throw new InvalidReferenceError("El servicio indicado no existe.");
    if (!staff) throw new InvalidReferenceError("El profesional indicado no existe.");

    const requestedStartMs = toUtcInstant(input.date, input.time, input.businessTimezone).getTime();
    const availability = await searchAvailability(
      input.businessId,
      input.businessTimezone,
      input.date,
      service.durationMinutes,
      input.staffId,
    );
    const staffSlots = availability[0]?.slots ?? [];
    const matchingSlot = findMatchingSlot(staffSlots, requestedStartMs);

    const startsAt = matchingSlot?.startsAt ?? new Date(requestedStartMs);
    const endsAt =
      matchingSlot?.endsAt ?? new Date(requestedStartMs + service.durationMinutes * 60_000);

    return {
      summary: {
        service: {
          id: service.id,
          name: service.name,
          price: service.price,
          durationMinutes: service.durationMinutes,
        },
        staff: { id: staff.id, name: staff.name },
        date: input.date,
        time: input.time,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        isAvailable: Boolean(matchingSlot),
        note: matchingSlot
          ? "Todavía no se guardó — falta que el negocio la confirme."
          : "Ese horario ya no está disponible; pedile al cliente que elija otro.",
      },
    };
  },
};
