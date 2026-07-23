import type { ToolCall } from "./tool-definition";

/**
 * Los cuatro roles estándar en cualquier conversación con un modelo de
 * lenguaje — comunes a OpenAI, Anthropic y Gemini, aunque cada uno los
 * nombre distinto puertas adentro de su propio SDK.
 */
export const CHAT_ROLES = ["system", "user", "assistant", "tool"] as const;

export type ChatRole = (typeof CHAT_ROLES)[number];

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Solo aplica a `role: "tool"` — a qué `ToolCall.id` le está respondiendo este mensaje. */
  toolCallId?: string;
  /**
   * Solo aplica a `role: "assistant"` — qué tools pidió ejecutar en este
   * turno. Necesario para reenviar el historial en la siguiente vuelta de
   * un loop de tool-calling real: el turno del asistente que pidió una
   * tool tiene que volver a incluir ese pedido (no solo texto), o el
   * proveedor no puede correlacionar el `tool_result` que le sigue.
   */
  toolCalls?: ToolCall[];
}
