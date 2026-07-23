import type Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  FinishReason,
  ToolCall,
  ToolChoice,
  ToolDefinition,
} from "../domain";

/**
 * Mapeo puro entre las formas agnósticas de `ai/domain` y las formas
 * reales del SDK de Anthropic — separado del provider (que sí hace la
 * llamada HTTP) para poder testear esta traducción sin mockear nada.
 */

/**
 * Anthropic no tiene rol "system" en `messages` — va aparte, como parámetro
 * `system`. Se marca como bloque cacheable (`cache_control: ephemeral`)
 * porque es idéntico en cada vuelta del Conversation Loop dentro de un mismo
 * turno (hasta `maxIterations` llamadas reusan el mismo `AgentContext`, ver
 * `conversation-loop.ts`) — sin esto, Anthropic reprocesa el prompt completo
 * del negocio (servicios, equipo, reservas próximas) en cada vuelta aunque
 * no haya cambiado ni un carácter.
 */
export function toAnthropicSystem(
  messages: ChatMessage[],
): Anthropic.Messages.TextBlockParam[] | undefined {
  const systemMessages = messages.filter((message) => message.role === "system");
  if (systemMessages.length === 0) return undefined;

  const text = systemMessages.map((message) => message.content).join("\n\n");
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

export function toAnthropicMessages(messages: ChatMessage[]): Anthropic.Messages.MessageParam[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      if (message.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: message.toolCallId ?? "",
              content: message.content,
            },
          ],
        };
      }

      // Un turno del asistente que pidió tools tiene que reenviar esos
      // pedidos (no solo el texto que los acompañó) — si no, Anthropic no
      // puede correlacionar el/los tool_result que le siguen.
      if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
        const blocks: Anthropic.Messages.ContentBlockParam[] = [];
        if (message.content) blocks.push({ type: "text", text: message.content });
        for (const toolCall of message.toolCalls) {
          blocks.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments,
          });
        }
        return { role: "assistant", content: blocks };
      }

      return { role: message.role, content: message.content };
    });
}

/**
 * El set de tools es el mismo objeto en cada vuelta del loop (se construye
 * una sola vez por turno en `agent/service.ts`) — marcar `cache_control` en
 * la ÚLTIMA tool le dice a Anthropic que cachee el bloque entero hasta ahí
 * (sistema + todas las tools), no solo esa tool puntual.
 */
export function toAnthropicTools(
  tools: ToolDefinition[] | undefined,
): Anthropic.Messages.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool, index) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
    ...(index === tools.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

export function toAnthropicToolChoice(
  toolChoice: ToolChoice | undefined,
): Anthropic.Messages.ToolChoice | undefined {
  if (!toolChoice || toolChoice === "auto") return { type: "auto" };
  if (toolChoice === "none") return { type: "none" };
  return { type: "tool", name: toolChoice.name };
}

function mapStopReason(reason: Anthropic.Messages.StopReason | null): FinishReason {
  switch (reason) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "stop";
  }
}

/** Construye los parámetros reales del SDK a partir de un `CompletionRequest` agnóstico. */
export function toAnthropicRequestParams(
  request: CompletionRequest,
  model: string,
): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: request.maxOutputTokens ?? 1024,
    system: toAnthropicSystem(request.messages),
    messages: toAnthropicMessages(request.messages),
    tools: toAnthropicTools(request.tools),
    tool_choice: toAnthropicToolChoice(request.toolChoice),
  };
}

/** Traduce la respuesta real del SDK de vuelta a un `CompletionResponse` agnóstico. */
export function fromAnthropicMessage(message: Anthropic.Messages.Message): CompletionResponse {
  const toolCalls: ToolCall[] = message.content
    .filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      arguments: block.input as Record<string, unknown>,
    }));

  const textBlock = message.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === "text",
  );

  return {
    message: {
      role: "assistant",
      content: textBlock?.text ?? "",
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    },
    toolCalls,
    usage: {
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      totalTokens: message.usage.input_tokens + message.usage.output_tokens,
    },
    finishReason: mapStopReason(message.stop_reason),
  };
}
