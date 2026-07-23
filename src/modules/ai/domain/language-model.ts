import type { CompletionRequest, CompletionResponse } from "./completion";
import type { AIProviderName } from "./provider-name";

/**
 * Contrato que cumple cualquier proveedor de IA. Es la única forma en la
 * que el resto de este módulo (y, a través de `AIService`, el resto del
 * proyecto) puede pedirle algo a un modelo — nunca importando el SDK de
 * OpenAI/Anthropic/Gemini directamente.
 */
export interface LanguageModel {
  name: AIProviderName;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
