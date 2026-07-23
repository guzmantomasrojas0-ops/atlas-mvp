import { toJSONSchema } from "zod";
import type { ToolDefinition } from "@/modules/ai";
import type { AgentContext } from "./context";
import type { Tool, ToolName } from "./tool";

/**
 * Qué campos de cada Tool ya conoce el sistema por el `AgentContext` — y
 * que el modelo nunca debe ver ni completar. `businessId`/`clientId`/
 * `businessTimezone`/`businessName` no son datos que el modelo pueda saber
 * de verdad; dejar que los "adivine" (o peor, que los proponga él) sería
 * confiar en un identificador de tenant que viene de afuera. Se ocultan acá
 * y se inyectan siempre desde el contexto, nunca desde lo que el modelo
 * mande.
 */
const TOOL_HIDDEN_PARAMS: Partial<Record<ToolName, readonly string[]>> = {
  SEARCH_AVAILABILITY: ["businessId", "businessTimezone"],
  FIND_SERVICE: ["businessId"],
  FIND_STAFF: ["businessId"],
  GET_BUSINESS_HOURS: ["businessName", "businessTimezone"],
  // "now" es solo para inyectar una hora fija en tests — nunca debe
  // llegar a completarlo un modelo real.
  GET_UPCOMING_APPOINTMENTS: ["businessId", "clientId", "now"],
  PREPARE_BOOKING_SUMMARY: ["businessId", "businessTimezone"],
  CREATE_APPOINTMENT: ["businessId", "businessTimezone", "clientId"],
};

const TOOL_CONTEXT_DEFAULTS: Partial<
  Record<ToolName, (context: AgentContext) => Record<string, unknown>>
> = {
  SEARCH_AVAILABILITY: (context) => ({
    businessId: context.businessId,
    businessTimezone: context.businessTimezone,
  }),
  FIND_SERVICE: (context) => ({ businessId: context.businessId }),
  FIND_STAFF: (context) => ({ businessId: context.businessId }),
  GET_BUSINESS_HOURS: (context) => ({
    businessName: context.businessName,
    businessTimezone: context.businessTimezone,
  }),
  GET_UPCOMING_APPOINTMENTS: (context) => ({
    businessId: context.businessId,
    clientId: context.clientId,
  }),
  PREPARE_BOOKING_SUMMARY: (context) => ({
    businessId: context.businessId,
    businessTimezone: context.businessTimezone,
  }),
  CREATE_APPOINTMENT: (context) => ({
    businessId: context.businessId,
    businessTimezone: context.businessTimezone,
    clientId: context.clientId,
  }),
};

/**
 * Recordatorio que se agrega a la descripción de cualquier Tool con
 * `requiresConfirmation` — un único lugar, para que la próxima Tool que
 * escriba datos (cancelar, reprogramar) quede protegida igual sin tocar el
 * system prompt de nuevo.
 */
const CONFIRMATION_REMINDER =
  ' Esta acción modifica datos reales. Llamala únicamente después de que el cliente haya confirmado explícitamente (por ejemplo: "sí", "confirmar", "perfecto", "dale", "hacé la reserva") — nunca antes, y nunca asumas una confirmación implícita.';

function omitProperties(
  schema: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  if (keys.length === 0) return schema;

  const properties = { ...(schema.properties as Record<string, unknown> | undefined) };
  for (const key of keys) delete properties[key];

  const required = Array.isArray(schema.required)
    ? (schema.required as string[]).filter((key) => !keys.includes(key))
    : undefined;

  return { ...schema, properties, ...(required ? { required } : {}) };
}

/**
 * Convierte una Tool del agente en la forma agnóstica que `ai` expone a un
 * modelo — reusando el `inputSchema` (Zod) que la Tool ya declara para el
 * Execution Engine, en vez de describir sus parámetros una segunda vez a
 * mano. Los campos que el sistema inyecta (ver `TOOL_HIDDEN_PARAMS`) se
 * ocultan acá para que el modelo no pierda tiempo (ni tenga la posibilidad)
 * intentando completarlos.
 */
export function toolToDefinition(tool: Tool): ToolDefinition {
  const hidden = TOOL_HIDDEN_PARAMS[tool.name] ?? [];
  // "any": algún campo (como el `now: z.date()` de test-only de
  // GetUpcomingAppointments) no tiene una forma representable en JSON
  // Schema — ese campo igual se oculta abajo, esto solo evita que la
  // conversión reviente antes de llegar ahí.
  const schema = toJSONSchema(tool.inputSchema, { unrepresentable: "any" }) as Record<
    string,
    unknown
  >;

  return {
    name: tool.name,
    description: tool.requiresConfirmation
      ? tool.description + CONFIRMATION_REMINDER
      : tool.description,
    parameters: omitProperties(schema, hidden),
  };
}

export function buildToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map(toolToDefinition);
}

/**
 * Completa el input que devolvió el modelo con los campos que el sistema
 * ya sabe por contexto — el contexto siempre gana sobre lo que el modelo
 * haya mandado, si mandó algo para esos campos. Si la tool no tiene
 * defaults de contexto declarados, el input del modelo se usa tal cual.
 */
export function applyToolContextDefaults(
  toolName: string,
  modelArgs: Record<string, unknown>,
  context: AgentContext,
): unknown {
  const buildDefaults = TOOL_CONTEXT_DEFAULTS[toolName as ToolName];
  if (!buildDefaults) return modelArgs;
  return { ...modelArgs, ...buildDefaults(context) };
}
