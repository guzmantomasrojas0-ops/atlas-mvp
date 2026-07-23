import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AIService, UnknownProviderError } from "@/modules/ai";
import type { LanguageModel } from "@/modules/ai";
import { createAnthropicProvider, createGeminiProvider } from "@/modules/ai/providers";

const ORIGINAL_AI_PROVIDER = process.env.AI_PROVIDER;

beforeEach(() => {
  delete process.env.AI_PROVIDER;
});

afterEach(() => {
  if (ORIGINAL_AI_PROVIDER === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = ORIGINAL_AI_PROVIDER;
  }
});

describe("AIService", () => {
  it("usa 'openai' por defecto si AI_PROVIDER no está seteada", () => {
    const service = new AIService();
    expect(service.providerName).toBe("openai");
  });

  it("respeta AI_PROVIDER cuando está seteada", () => {
    process.env.AI_PROVIDER = "gemini";
    const service = new AIService();
    expect(service.providerName).toBe("gemini");
  });

  it("tira UnknownProviderError si AI_PROVIDER tiene un valor no soportado", () => {
    process.env.AI_PROVIDER = "chatgpt";
    expect(() => new AIService()).toThrow(UnknownProviderError);
  });

  it("acepta un provider explícito, ignorando por completo AI_PROVIDER", () => {
    process.env.AI_PROVIDER = "gemini";
    const service = new AIService(createAnthropicProvider());
    expect(service.providerName).toBe("anthropic");
  });

  it("complete() delega en el provider configurado", async () => {
    const service = new AIService(createGeminiProvider());
    const response = await service.complete({
      messages: [
        { role: "system", content: "Sos el asistente de una barbería." },
        { role: "user", content: "¿Cuánto sale el corte?" },
      ],
    });

    expect(response.message.content).toContain("gemini");
    expect(response.message.content).toContain("¿Cuánto sale el corte?");
  });

  it("delega en cualquier LanguageModel que se le pase, sea cual sea", async () => {
    const fakeModel: LanguageModel = {
      name: "openai",
      complete: async () => ({
        message: { role: "assistant", content: "respuesta del fake" },
        toolCalls: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: "stop",
      }),
    };

    const service = new AIService(fakeModel);
    const response = await service.complete({ messages: [{ role: "user", content: "hola" }] });

    expect(response.message.content).toBe("respuesta del fake");
  });

  it("cambiar de provider no cambia la forma de la respuesta — misma interfaz para los tres", async () => {
    const request = { messages: [{ role: "user" as const, content: "test" }] };
    const openaiResponse = await new AIService().complete(request);
    process.env.AI_PROVIDER = "gemini";
    const geminiResponse = await new AIService().complete(request);

    expect(Object.keys(openaiResponse).sort()).toEqual(Object.keys(geminiResponse).sort());
  });
});
