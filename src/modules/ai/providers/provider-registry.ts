import type { AIProviderName, LanguageModel, ProviderConfig } from "../domain";
import { createAnthropicProvider } from "./anthropic-provider";
import { createGeminiProvider } from "./gemini-provider";
import { createOpenAIProvider } from "./openai-provider";

const PROVIDER_FACTORIES: Record<AIProviderName, (config?: ProviderConfig) => LanguageModel> = {
  openai: createOpenAIProvider,
  anthropic: createAnthropicProvider,
  gemini: createGeminiProvider,
};

/**
 * Instancia el proveedor pedido. Confía en que `name` ya es válido — la
 * validación de un string arbitrario (por ejemplo, `AI_PROVIDER` leído del
 * entorno) es trabajo de `isAIProviderName`, no de esta función.
 */
export function createProvider(name: AIProviderName, config?: ProviderConfig): LanguageModel {
  return PROVIDER_FACTORIES[name](config);
}
