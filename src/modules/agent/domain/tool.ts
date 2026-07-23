import type { ZodType } from "zod";

/**
 * Nombres de las herramientas que el agente puede invocar. Las de solo
 * lectura (SEARCH_AVAILABILITY, FIND_SERVICE, FIND_STAFF,
 * GET_BUSINESS_HOURS, GET_UPCOMING_APPOINTMENTS, PREPARE_BOOKING_SUMMARY) y
 * CREATE_APPOINTMENT (Sprint 14, la primera que escribe datos reales) ya
 * tienen una implementación registrada (ver `agent/tools/`) —
 * CANCEL_APPOINTMENT/UPDATE_APPOINTMENT todavía no, el nombre existe para
 * que Policy y el pipeline por reglas puedan razonar sobre "qué herramienta
 * correspondería" sin que exista una implementación real detrás.
 */
export const TOOL_NAMES = [
  "SEARCH_AVAILABILITY",
  "CREATE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "UPDATE_APPOINTMENT",
  "FIND_SERVICE",
  "FIND_STAFF",
  "GET_BUSINESS_HOURS",
  "GET_UPCOMING_APPOINTMENTS",
  "PREPARE_BOOKING_SUMMARY",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Contrato de una herramienta. `TInput`/`TOutput` quedan abiertos a
 * propósito — cada herramienta futura define su propia forma de datos, el
 * registro solo necesita saber que cumple esta forma. `inputSchema` es lo
 * que le permite al Execution Engine validar el input de cualquier
 * herramienta de forma genérica, sin conocer nada específico de ella.
 *
 * `requiresConfirmation`: marca una tool que modifica datos reales — el
 * modelo solo debe llamarla después de que el cliente confirmó
 * explícitamente (ver `tool-bridge.ts`, que refuerza esto en la
 * descripción que ve el modelo, y `system-prompt.ts`, que lo explica con
 * ejemplos). No es una garantía de código: detectar "esto es una
 * confirmación" en texto libre es justamente el trabajo del modelo, no de
 * un clasificador separado (ver Sprint 12). La seguridad de los datos no
 * depende de que el modelo respete esto — depende de que la propia Tool
 * vuelva a validar todo del lado del servidor sin importar por qué la
 * llamaron.
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  name: ToolName;
  description: string;
  inputSchema: ZodType<TInput>;
  requiresConfirmation?: boolean;
  execute(input: TInput): Promise<TOutput>;
}
