import type { ChatMessage } from "./chat-message";
import type { ToolCall, ToolDefinition } from "./tool-definition";
import type { Usage } from "./usage";

/** Por qué el modelo dejó de generar — el mismo vocabulario en los tres proveedores. */
export const FINISH_REASONS = ["stop", "tool_calls", "length", "content_filter"] as const;

export type FinishReason = (typeof FINISH_REASONS)[number];

/**
 * Cómo debe usar el modelo las `tools` de la request: decidir libremente
 * ("auto"), no usar ninguna ("none"), o estar obligado a llamar una
 * puntual — la única forma de garantizar salida estructurada real en vez
 * de parsear texto libre.
 */
export type ToolChoice = "auto" | "none" | { type: "tool"; name: string };

/** Lo que cualquier `LanguageModel` recibe — sin nada específico de un proveedor. */
export interface CompletionRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Lo que cualquier `LanguageModel` devuelve. */
export interface CompletionResponse {
  message: ChatMessage;
  toolCalls: ToolCall[];
  usage: Usage;
  finishReason: FinishReason;
}
