import { describe, expect, it } from "vitest";
import {
  createAnthropicProvider,
  createGeminiProvider,
  createOpenAIProvider,
  createProvider,
} from "@/modules/ai/providers";
import { MissingCredentialsError } from "@/modules/ai/domain";
import type { CompletionRequest, LanguageModel } from "@/modules/ai/domain";

const REQUEST: CompletionRequest = {
  messages: [{ role: "user", content: "hola" }],
};

describe.each([
  ["openai", createOpenAIProvider],
  ["anthropic", createAnthropicProvider],
  ["gemini", createGeminiProvider],
] as const)("%s provider", (expectedName, factory) => {
  it("declara el nombre correcto", () => {
    const provider: LanguageModel = factory();
    expect(provider.name).toBe(expectedName);
  });

  it("acepta config opcional sin romper", () => {
    expect(() => factory({ model: "algún-modelo" })).not.toThrow();
  });
});

// OpenAI y Gemini todavía son mocks (Sprint 10) — devuelven una respuesta
// simulada sin necesitar ninguna credencial. Anthropic ya es real desde el
// Sprint 11 (ver ai-anthropic-provider.test.ts para su comportamiento real,
// mockeando el SDK, no la red).
describe.each([
  ["openai", createOpenAIProvider],
  ["gemini", createGeminiProvider],
] as const)("%s provider (simulado)", (expectedName, factory) => {
  it("complete() devuelve una respuesta simulada con ese nombre", async () => {
    const provider = factory();
    const response = await provider.complete(REQUEST);
    expect(response.message.content).toContain(expectedName);
  });
});

describe("createProvider", () => {
  it("instancia el provider simulado correcto para openai/gemini", async () => {
    const openai = await createProvider("openai").complete(REQUEST);
    const gemini = await createProvider("gemini").complete(REQUEST);

    expect(openai.message.content).toContain("openai");
    expect(gemini.message.content).toContain("gemini");
  });

  it("instancia un provider real de anthropic — sin API key, falla al usarlo, no al crearlo", async () => {
    const provider = createProvider("anthropic");
    expect(provider.name).toBe("anthropic");
    await expect(provider.complete(REQUEST)).rejects.toThrow(MissingCredentialsError);
  });

  it("todos los proveedores cumplen exactamente la misma interfaz", () => {
    const providers = [
      createProvider("openai"),
      createProvider("anthropic"),
      createProvider("gemini"),
    ];
    for (const provider of providers) {
      expect(typeof provider.name).toBe("string");
      expect(typeof provider.complete).toBe("function");
    }
  });
});
