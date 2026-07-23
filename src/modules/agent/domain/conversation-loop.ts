import type { AIService, ChatMessage, ToolDefinition, ToolResult } from "@/modules/ai";
import type { AgentContext } from "./context";
import { executeTool, type ToolExecutionResult } from "./execution";
import { applyToolContextDefaults } from "./tool-bridge";
import type { ToolRegistry } from "./tool-registry";

export interface ConversationLoopLimits {
  /** Cuántas veces, como máximo, se le vuelve a preguntar al modelo en un mismo turno. */
  maxIterations: number;
  /** Cuántas veces puede repetirse la MISMA tool con los MISMOS argumentos antes de cortar. */
  maxRepeatedToolCalls: number;
}

// 6 vueltas alcanza de sobra para encadenar un par de tools reales en una
// misma respuesta, sin dejar una conversación de prueba corriendo
// indefinidamente. 2 repeticiones tolera un reintento legítimo (el cliente
// cambió de fecha, por ejemplo) pero corta ante un modelo dando vueltas.
const DEFAULT_LIMITS: ConversationLoopLimits = {
  maxIterations: 6,
  maxRepeatedToolCalls: 2,
};

export const CONVERSATION_LOOP_STOP_REASONS = [
  "final_response",
  "max_iterations",
  "repeated_tool_call",
  "empty_response",
] as const;

export type ConversationLoopStopReason = (typeof CONVERSATION_LOOP_STOP_REASONS)[number];

/** Un paso ejecutado durante el loop — qué tool, con qué input, y su resultado estructurado. */
export interface ConversationLoopStep {
  toolName: string;
  input: unknown;
  result: ToolExecutionResult;
}

/**
 * Resultado del loop. `response` es `null` cuando el loop tuvo que
 * detenerse por un límite de seguridad en vez de llegar a una respuesta
 * real — un resultado controlado siempre, nunca una excepción.
 */
export interface ConversationLoopResult {
  response: string | null;
  steps: ConversationLoopStep[];
  stopReason: ConversationLoopStopReason;
  messages: ChatMessage[];
}

export interface ConversationLoopDependencies {
  aiService: AIService;
  toolRegistry: ToolRegistry;
  toolDefinitions: ToolDefinition[];
  context: AgentContext;
  limits?: Partial<ConversationLoopLimits>;
}

function toAiToolResult(toolCallId: string, execution: ToolExecutionResult): ToolResult {
  if (execution.success) return { toolCallId, result: execution.payload };
  return { toolCallId, result: null, error: execution.error?.message ?? "La herramienta falló." };
}

function toolResultToChatMessage(toolResult: ToolResult): ChatMessage {
  return {
    role: "tool",
    toolCallId: toolResult.toolCallId,
    content: JSON.stringify(toolResult.error ? { error: toolResult.error } : toolResult.result),
  };
}

function toolCallSignature(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(args)}`;
}

/**
 * El loop conversacional: manda el historial + las tools disponibles al
 * mismo modelo en cada vuelta — nunca uno para clasificar y otro para
 * responder. Si pide ejecutar una tool, la corre a través del Execution
 * Engine existente (que ya resuelve "tool inexistente"/"input inválido" —
 * nada de eso se duplica acá), agrega el resultado al historial y vuelve a
 * preguntarle. Termina cuando el modelo responde en texto sin pedir más
 * tools, o cuando algún límite de seguridad se activa.
 */
export async function runConversationLoop(
  initialMessages: ChatMessage[],
  deps: ConversationLoopDependencies,
): Promise<ConversationLoopResult> {
  const limits: ConversationLoopLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const messages = [...initialMessages];
  const steps: ConversationLoopStep[] = [];
  const toolCallCounts = new Map<string, number>();

  for (let iteration = 0; iteration < limits.maxIterations; iteration++) {
    const response = await deps.aiService.complete({
      messages,
      tools: deps.toolDefinitions,
      toolChoice: "auto",
    });

    if (response.toolCalls.length === 0) {
      const content = response.message.content?.trim();
      if (!content) {
        return { response: null, steps, stopReason: "empty_response", messages };
      }
      messages.push({ role: "assistant", content });
      return { response: content, steps, stopReason: "final_response", messages };
    }

    messages.push(response.message);

    for (const toolCall of response.toolCalls) {
      const signature = toolCallSignature(toolCall.name, toolCall.arguments);
      const timesSeen = (toolCallCounts.get(signature) ?? 0) + 1;

      if (timesSeen > limits.maxRepeatedToolCalls) {
        return { response: null, steps, stopReason: "repeated_tool_call", messages };
      }
      toolCallCounts.set(signature, timesSeen);

      const input = applyToolContextDefaults(toolCall.name, toolCall.arguments, deps.context);
      const executionResult = await executeTool(toolCall.name, input, deps.toolRegistry);
      steps.push({ toolName: toolCall.name, input, result: executionResult });

      messages.push(toolResultToChatMessage(toAiToolResult(toolCall.id, executionResult)));
    }
  }

  return { response: null, steps, stopReason: "max_iterations", messages };
}
