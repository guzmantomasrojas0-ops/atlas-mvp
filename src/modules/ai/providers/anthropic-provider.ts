import Anthropic from "@anthropic-ai/sdk";
import { MissingCredentialsError, type LanguageModel, type ProviderConfig } from "../domain";
import { fromAnthropicMessage, toAnthropicRequestParams } from "./anthropic-mapping";

// Modelo rápido y económico — usado hoy para todo el Conversation Loop
// (Sprint 12 en adelante: decidir qué tool llamar y redactar la respuesta
// final, no solo clasificar). Si la calidad de las respuestas en producción
// no alcanza para el tool-calling multi-turno del flujo de reserva, subir a
// un modelo más grande (ej. Sonnet) es la primera palanca a probar — ver
// informe de Production Readiness, sección IA.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Provider real: hace una llamada HTTP genuina a la API de Anthropic. La
 * credencial se lee de `ANTHROPIC_API_KEY` recién al primer `complete()` —
 * importar este módulo, o incluso instanciar el provider, no debe fallar
 * solo porque todavía no hay ninguna key configurada.
 */
export function createAnthropicProvider(config: ProviderConfig = {}): LanguageModel {
  let client: Anthropic | null = null;

  function getClient(): Anthropic {
    if (client) return client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new MissingCredentialsError(
        "Falta ANTHROPIC_API_KEY — necesaria para usar el proveedor real de Anthropic.",
      );
    }
    client = new Anthropic({ apiKey });
    return client;
  }

  return {
    name: "anthropic",
    async complete(request) {
      const message = await getClient().messages.create(
        toAnthropicRequestParams(request, config.model ?? DEFAULT_MODEL),
      );
      return fromAnthropicMessage(message);
    },
  };
}
