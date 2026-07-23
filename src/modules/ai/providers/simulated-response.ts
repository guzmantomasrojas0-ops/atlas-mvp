import type { AIProviderName, ChatMessage, CompletionRequest, CompletionResponse } from "../domain";

function lastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return [...messages].reverse().find((message) => message.role === "user");
}

/**
 * Respuesta simulada, compartida por los tres providers — todavía no hay
 * credenciales reales para OpenAI ni Gemini, así que no hay nada específico
 * de esos proveedores que simular; lo único que cambia entre ellos es el
 * nombre. Sirve para validar que un `CompletionRequest` viaja completo
 * hasta acá y que un `CompletionResponse` con la forma correcta vuelve —
 * no para simular texto realista.
 *
 * Si `toolChoice` fuerza una tool puntual, devuelve un `ToolCall` para esa
 * tool (con argumentos vacíos, no hay razonamiento real acá) en vez de
 * texto — cualquier proveedor real haría lo mismo, así que el mock tiene
 * que reflejarlo para seguir siendo honesto sobre "los tres cumplen
 * exactamente la misma interfaz".
 */
export function buildSimulatedResponse(
  providerName: AIProviderName,
  request: CompletionRequest,
): CompletionResponse {
  if (typeof request.toolChoice === "object" && request.toolChoice.type === "tool") {
    const { name } = request.toolChoice;
    const toolCalls = [{ id: `simulated-${name}`, name, arguments: {} }];
    return {
      message: { role: "assistant", content: "", toolCalls },
      toolCalls,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: "tool_calls",
    };
  }

  const userMessage = lastUserMessage(request.messages);

  return {
    message: {
      role: "assistant",
      content: `[respuesta simulada de ${providerName}] recibido: "${userMessage?.content ?? ""}"`,
    },
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "stop",
  };
}
