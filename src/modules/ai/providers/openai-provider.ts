import type { LanguageModel, ProviderConfig } from "../domain";
import { buildSimulatedResponse } from "./simulated-response";

/**
 * Todavía no hace ninguna llamada HTTP ni usa credenciales reales — el
 * `config` existe para cuando lo haga (elegir modelo, etc.), pero hoy no
 * se usa. Devuelve una respuesta simulada para validar que la arquitectura
 * funciona igual sin importar el proveedor.
 */
export function createOpenAIProvider(_config: ProviderConfig = {}): LanguageModel {
  return {
    name: "openai",
    async complete(request) {
      return buildSimulatedResponse("openai", request);
    },
  };
}
