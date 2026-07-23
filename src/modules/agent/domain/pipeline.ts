import type { AgentContext } from "./context";
import { executeTool, type ToolExecutionResult } from "./execution";
import type { Intent } from "./intent";
import type { IntentResolver } from "./intent-resolver";
import { selectPlannedAction, type PlannedAction } from "./planned-action";
import type { PolicyDecision } from "./policy";
import type { ToolRegistry } from "./tool-registry";

/**
 * Colaboradores que el pipeline necesita para correr. Se inyectan en vez de
 * importarse fijo — así cada etapa se puede reemplazar (por ejemplo, un
 * `IntentResolver` respaldado por IA) sin tocar el pipeline en sí, y se
 * puede probar con fakes sin ninguna I/O real.
 */
export interface AgentPipelineDependencies {
  resolveIntent: IntentResolver;
  evaluatePolicy: (intent: Intent, context: AgentContext) => PolicyDecision;
  toolRegistry: ToolRegistry;
}

/**
 * Resultado de una corrida del pipeline. Ya ejecuta la herramienta
 * planeada (si hay una) y devuelve su resultado estructurado — pero no
 * genera ninguna respuesta en lenguaje natural. Eso sigue siendo trabajo de
 * un sprint futuro, una vez exista un modelo real detrás de `resolveIntent`.
 */
export interface AgentPipelineResult {
  message: string;
  intent: Intent;
  context: AgentContext;
  decision: PolicyDecision;
  plannedAction: PlannedAction | null;
  execution: ToolExecutionResult | null;
}

/**
 * El flujo completo: mensaje → intent → (contexto ya construido) →
 * políticas → herramienta planeada → ejecución → resultado estructurado.
 * El contexto se construye antes de llamar acá (requiere I/O) para que
 * política/planificación se puedan testear sin tocar la base de datos.
 * `resolveIntent` y la ejecución de la tool son la única I/O que esta
 * función hace — desde el Sprint 11, `resolveIntent` puede ser una llamada
 * real a un modelo de IA, no solo reglas.
 */
export async function runAgentPipeline(
  message: string,
  context: AgentContext,
  deps: AgentPipelineDependencies,
): Promise<AgentPipelineResult> {
  const intent = await deps.resolveIntent(message);
  const decision = deps.evaluatePolicy(intent, context);
  const plannedAction = selectPlannedAction(intent, decision, context, deps.toolRegistry);
  const execution = plannedAction
    ? await executeTool(plannedAction.tool, plannedAction.input, deps.toolRegistry)
    : null;

  return { message, intent, context, decision, plannedAction, execution };
}
