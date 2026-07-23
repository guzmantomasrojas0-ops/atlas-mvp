import { z } from "zod";
import { BUSINESS_HOURS_END, BUSINESS_HOURS_START } from "@/modules/scheduling/domain";
import type { Tool } from "../domain";

export const getBusinessHoursInputSchema = z.object({
  businessName: z.string().min(1),
  businessTimezone: z.string().min(1),
});

export type GetBusinessHoursInput = z.infer<typeof getBusinessHoursInputSchema>;

export interface GetBusinessHoursOutput {
  businessName: string;
  timezone: string;
  openHour: number;
  closeHour: number;
  note: string;
}

/**
 * Devuelve el horario de atención y la zona horaria del negocio. No recibe
 * `businessId` a propósito — nombre y zona horaria ya están disponibles en
 * el `AgentContext` de quien llama, no hace falta volver a consultarlos.
 *
 * El horario en sí todavía es la misma ventana fija que usa el calendario
 * (`BUSINESS_HOURS_START`/`END`) — el negocio todavía no tiene un horario
 * configurable propio, así que no se inventa ese dato.
 */
export const getBusinessHoursTool: Tool<GetBusinessHoursInput, GetBusinessHoursOutput> = {
  name: "GET_BUSINESS_HOURS",
  description: "Devuelve el horario general de atención y la zona horaria del negocio.",
  inputSchema: getBusinessHoursInputSchema,
  async execute(input) {
    return {
      businessName: input.businessName,
      timezone: input.businessTimezone,
      openHour: BUSINESS_HOURS_START,
      closeHour: BUSINESS_HOURS_END,
      note: "Horario general de referencia — todavía no es configurable por negocio.",
    };
  },
};
