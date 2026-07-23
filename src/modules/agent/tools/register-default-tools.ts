import type { ToolRegistry } from "../domain";
import { createAppointmentTool } from "./create-appointment-tool";
import { findServiceTool } from "./find-service-tool";
import { findStaffTool } from "./find-staff-tool";
import { getBusinessHoursTool } from "./get-business-hours-tool";
import { getUpcomingAppointmentsTool } from "./get-upcoming-appointments-tool";
import { prepareBookingSummaryTool } from "./prepare-booking-summary-tool";
import { searchAvailabilityTool } from "./search-availability-tool";

/**
 * Registra las herramientas de solo lectura (Sprint 8), la de resumen de
 * reserva (Sprint 13), y CREATE_APPOINTMENT (Sprint 14 — la primera que
 * escribe datos reales) en el registro dado.
 */
export function registerDefaultTools(registry: ToolRegistry): void {
  registry.register(searchAvailabilityTool);
  registry.register(findServiceTool);
  registry.register(findStaffTool);
  registry.register(getBusinessHoursTool);
  registry.register(getUpcomingAppointmentsTool);
  registry.register(prepareBookingSummaryTool);
  registry.register(createAppointmentTool);
}
