import { aiService as defaultAIService, type AIService, type ChatMessage } from "@/modules/ai";
import { logger } from "@/lib/logger";
import { sendMessage } from "@/modules/conversation";
import {
  buildAgentContext as buildContextFromRaw,
  buildSystemPrompt,
  buildToolDefinitions,
  evaluatePolicy,
  InMemoryMemoryStore,
  keywordIntentResolver,
  runAgentPipeline,
  runConversationLoop,
  ToolRegistry,
  type AgentContext,
  type AgentPipelineResult,
  type ConversationLoopResult,
  type IntentResolver,
  type MessageSummary,
} from "./domain";
import { fetchRawAgentContext, type BusinessRef } from "./data";
import { registerDefaultTools } from "./tools";

/**
 * Registro e instancia de memoria compartidos por el proceso. El registro
 * ya trae registradas las herramientas de solo lectura del Sprint 8 (ver
 * `agent/tools/register-default-tools.ts`) — las que escriben datos
 * (crear/cancelar/cambiar una reserva) todavía no existen, así que ni el
 * pipeline de reglas ni el loop conversacional pueden planear esas
 * acciones, sin necesitar ningún caso especial. La memoria sigue sin
 * ninguna nota guardada.
 */
export const agentToolRegistry = new ToolRegistry();
registerDefaultTools(agentToolRegistry);

export const agentMemoryStore = new InMemoryMemoryStore();

/** Construye el contexto del agente para una conversación puntual (hace I/O). */
export async function buildAgentContext(
  business: BusinessRef,
  conversationId: string,
): Promise<AgentContext> {
  const raw = await fetchRawAgentContext(business, conversationId);
  return buildContextFromRaw(raw, new Date());
}

/**
 * Corre el pipeline determinístico (no conversacional): intent → contexto
 * → política → herramienta planeada → ejecución. No genera lenguaje
 * natural ni escribe nada en la conversación — pensado para quien no usa
 * IA. `resolveIntent` son reglas por palabras clave por defecto; pasar
 * otro resolver (por ejemplo uno respaldado por un modelo real, para
 * clasificar nada más) sigue siendo posible, sin necesitar una segunda
 * función — es la única diferencia que separaba lo que hasta el Sprint 11
 * eran `processMessage`/`processMessageWithAI`.
 */
export async function processMessage(
  business: BusinessRef,
  conversationId: string,
  message: string,
  resolveIntent: IntentResolver = keywordIntentResolver,
): Promise<AgentPipelineResult> {
  const context = await buildAgentContext(business, conversationId);
  return runAgentPipeline(message, context, {
    resolveIntent,
    evaluatePolicy,
    toolRegistry: agentToolRegistry,
  });
}

function toHistoryMessage(message: MessageSummary): ChatMessage {
  return { role: message.sender === "CLIENT" ? "user" : "assistant", content: message.content };
}

/**
 * El loop conversacional completo (Sprint 12): un único modelo real decide
 * cuándo necesita una herramienta, la pide vía tool-calling, recibe el
 * resultado a través del Execution Engine, y genera la respuesta final —
 * nunca un clasificador separado seguido de otro modelo. Reutiliza el
 * mismo Context Builder, el mismo Tool Registry y el mismo Execution
 * Engine que `processMessage`; lo único que cambia es que acá el modelo
 * elige la tool directamente, en vez de una tabla intent → tool.
 *
 * Si el loop termina con una respuesta real, se persiste en la
 * conversación como mensaje de AGENT — el sender reservado para esto
 * desde el Sprint 6. Si tuvo que cortar por un límite de seguridad
 * (`stopReason` distinto de "final_response"), no se escribe nada; quien
 * llama decide qué hacer (por ejemplo, escalar a un humano).
 */
export async function converseWithAgent(
  business: BusinessRef,
  conversationId: string,
  message: string,
  aiService: AIService = defaultAIService,
): Promise<ConversationLoopResult> {
  const context = await buildAgentContext(business, conversationId);
  const systemPrompt = buildSystemPrompt(context);
  const toolDefinitions = buildToolDefinitions(agentToolRegistry.list());

  const history: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...context.recentMessages.map(toHistoryMessage),
    { role: "user", content: message },
  ];

  const startedAt = Date.now();
  const result = await runConversationLoop(history, {
    aiService,
    toolRegistry: agentToolRegistry,
    toolDefinitions,
    context,
  });

  // Una línea estructurada por turno: duración total, tokens consumidos, y
  // cuánto tardó cada tool — la única forma de responder "¿por qué esta
  // conversación tardó/costó tanto?" sin tener que reproducirla.
  logger.info(
    {
      businessId: business.id,
      conversationId,
      durationMs: Date.now() - startedAt,
      stopReason: result.stopReason,
      usage: result.usage,
      steps: result.steps.map((step) => ({
        toolName: step.toolName,
        success: step.result.success,
        durationMs: step.result.executionTimeMs,
      })),
    },
    "converseWithAgent: turno completado.",
  );

  if (result.response) {
    await sendMessage(business.id, conversationId, result.response, "AGENT");
  }

  return result;
}
