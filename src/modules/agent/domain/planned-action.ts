import { SLOT_MINUTES, todayInTimezone } from "@/modules/scheduling/domain";
import type { AgentContext } from "./context";
import type { Intent } from "./intent";
import type { PolicyDecision } from "./policy";
import type { ToolRegistry } from "./tool-registry";
import type { ToolName } from "./tool";

/** Qué herramienta ATLAS invocaría, con qué input — todavía no la ejecuta. */
export interface PlannedAction {
  tool: ToolName;
  input: unknown;
  reason: string;
}

// Qué herramienta resolvería cada intent, si la política lo permite. No
// todos los intents tienen un mapeo — FIND_STAFF y
// GET_UPCOMING_APPOINTMENTS todavía no tienen un intent natural que los
// dispare, así que quedan registrados pero sin plan automático por ahora.
// Agregar uno nuevo es una línea en esta tabla, no lógica nueva acá abajo.
//
// BOOK_APPOINTMENT/CANCEL_APPOINTMENT/RESCHEDULE_APPOINTMENT quedan sin
// mapeo A PROPÓSITO, incluso ahora que CREATE_APPOINTMENT existe (Sprint
// 14): este pipeline por reglas no tiene ningún concepto de "el cliente
// confirmó" — ejecuta lo que la tabla diga, sin preguntar. Escribir datos
// reales sin esa confirmación sería inseguro; ese control solo existe en
// el loop conversacional (ver `pipeline.ts`/`conversation-loop.ts` y el
// `requiresConfirmation` de `tool.ts`), que sí lo tiene.
const TOOL_BY_INTENT: Partial<Record<Intent, ToolName>> = {
  CHECK_AVAILABILITY: "SEARCH_AVAILABILITY",
  ASK_HOURS: "GET_BUSINESS_HOURS",
  ASK_PRICE: "FIND_SERVICE",
};

/**
 * Construye el input real que cada Tool necesita, a partir del contexto ya
 * construido. Todavía no hay extracción de entidades (eso requeriría IA) —
 * donde el mensaje debería aportar un dato puntual ("mañana", "el corte"),
 * se usa un valor por defecto razonable: hoy en la zona horaria del
 * negocio, la duración del primer servicio cargado. Un futuro resolver con
 * IA reemplaza estos defaults por lo que el cliente realmente pidió, sin
 * tocar el resto del pipeline.
 */
const TOOL_INPUT_BY_INTENT: Partial<Record<Intent, (context: AgentContext) => unknown>> = {
  CHECK_AVAILABILITY: (context) => ({
    businessId: context.businessId,
    businessTimezone: context.businessTimezone,
    date: todayInTimezone(context.businessTimezone),
    serviceDurationMinutes: context.services[0]?.durationMinutes ?? SLOT_MINUTES,
  }),
  ASK_HOURS: (context) => ({
    businessName: context.businessName,
    businessTimezone: context.businessTimezone,
  }),
  ASK_PRICE: (context) => ({ businessId: context.businessId }),
};

/**
 * Decide qué herramienta correspondería a este intent, con qué input, sin
 * invocarla todavía. Si la herramienta no está registrada, no hay acción
 * planeada. (Ya no hay un chequeo de política separado acá: los únicos
 * intents mapeados en TOOL_BY_INTENT son informativos y siempre están
 * permitidos — el día que un intent necesite un gate real de política, ese
 * chequeo vuelve a agregarse acá, no antes.)
 */
export function selectPlannedAction(
  intent: Intent,
  decision: PolicyDecision,
  context: AgentContext,
  toolRegistry: ToolRegistry,
): PlannedAction | null {
  const tool = TOOL_BY_INTENT[intent];
  if (!tool) return null;
  if (!toolRegistry.has(tool)) return null;

  const buildInput = TOOL_INPUT_BY_INTENT[intent];
  return { tool, input: buildInput ? buildInput(context) : {}, reason: decision.reason };
}
