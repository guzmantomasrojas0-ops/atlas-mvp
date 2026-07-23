import {
  isAIProviderName,
  UnknownProviderError,
  type AIProviderName,
  type CompletionRequest,
  type CompletionResponse,
  type LanguageModel,
} from "./domain";
import { createProvider } from "./providers";

const DEFAULT_PROVIDER: AIProviderName = "openai";

/**
 * Lee `AI_PROVIDER` del entorno — el único lugar donde se decide qué
 * proveedor usa todo el proyecto. Cambiarlo (y reiniciar el proceso) alcanza
 * para pasar de OpenAI a Anthropic o Gemini sin tocar ningún otro archivo.
 */
function resolveConfiguredProviderName(): AIProviderName {
  const configured = process.env.AI_PROVIDER;
  if (!configured) return DEFAULT_PROVIDER;
  if (!isAIProviderName(configured)) {
    throw new UnknownProviderError(`"${configured}" no es un proveedor de IA soportado.`);
  }
  return configured;
}

/**
 * Único punto de contacto del resto del proyecto con un modelo de
 * lenguaje. Nadie más importa un provider directamente — ni siquiera el
 * Agent Engine, que todavía no depende de esto en absoluto (ver Sprint 10).
 * Acepta un provider explícito para tests; en producción siempre se usa el
 * singleton `aiService`, resuelto desde `AI_PROVIDER`.
 */
export class AIService {
  private readonly provider: LanguageModel;

  constructor(provider?: LanguageModel) {
    this.provider = provider ?? createProvider(resolveConfiguredProviderName());
  }

  get providerName(): AIProviderName {
    return this.provider.name;
  }

  complete(request: CompletionRequest): Promise<CompletionResponse> {
    return this.provider.complete(request);
  }
}

export const aiService = new AIService();
