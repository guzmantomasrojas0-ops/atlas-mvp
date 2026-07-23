import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissingCredentialsError } from "@/modules/ai/domain";
import { createAnthropicProvider } from "@/modules/ai/providers";

// `vi.mock` es hoisted por Vitest por encima de todos los imports — solo
// puede referenciar variables declaradas con `vi.hoisted`. Mockeamos el SDK
// completo (nunca la red real) siguiendo la misma postura de PLAN.md: "el
// LLM es no determinista y no pertenece al camino crítico de CI" — acá se
// testea que la traducción request/response sea correcta, no que Claude
// "razone bien".
const { mockCreate, MockAnthropic } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  // Función normal, no arrow — un mock usado con `new` necesita ser constructor.
  const MockAnthropic = vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: mockCreate } };
  });
  return { mockCreate, MockAnthropic };
});

vi.mock("@anthropic-ai/sdk", () => ({ default: MockAnthropic }));

const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

function fakeAnthropicMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    container: null,
    model: "claude-haiku-4-5-20251001",
    role: "assistant",
    stop_details: null,
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    content: [{ type: "text", text: "hola", citations: null }],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
  MockAnthropic.mockClear();
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
});

describe("createAnthropicProvider — SDK real mockeado", () => {
  it("no tira nada al crear el provider, aunque no haya API key todavía", () => {
    expect(() => createAnthropicProvider()).not.toThrow();
    expect(MockAnthropic).not.toHaveBeenCalled();
  });

  it("tira MissingCredentialsError recién al llamar complete(), si no hay ANTHROPIC_API_KEY", async () => {
    const provider = createAnthropicProvider();
    await expect(
      provider.complete({ messages: [{ role: "user", content: "hola" }] }),
    ).rejects.toThrow(MissingCredentialsError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("llama al SDK con los parámetros mapeados", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue(fakeAnthropicMessage());

    const provider = createAnthropicProvider({ model: "claude-haiku-4-5-20251001" });
    await provider.complete({
      messages: [
        { role: "system", content: "Sos un clasificador." },
        { role: "user", content: "¿cuánto sale el corte?" },
      ],
      tools: [
        { name: "classify_intent", description: "clasifica", parameters: { type: "object" } },
      ],
      toolChoice: { type: "tool", name: "classify_intent" },
    });

    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        system: [
          {
            type: "text",
            text: "Sos un clasificador.",
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: "¿cuánto sale el corte?" }],
        tool_choice: { type: "tool", name: "classify_intent" },
      }),
    );
  });

  it("devuelve la respuesta ya mapeada a CompletionResponse", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue(
      fakeAnthropicMessage({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "classify_intent",
            input: { intent: "ASK_PRICE" },
            caller: { type: "direct" },
          },
        ],
      }),
    );

    const provider = createAnthropicProvider();
    const response = await provider.complete({ messages: [{ role: "user", content: "hola" }] });

    expect(response.toolCalls).toEqual([
      { id: "call-1", name: "classify_intent", arguments: { intent: "ASK_PRICE" } },
    ]);
    expect(response.finishReason).toBe("tool_calls");
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it("reutiliza el mismo cliente entre llamadas — no reconstruye el SDK en cada complete()", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate.mockResolvedValue(fakeAnthropicMessage());

    const provider = createAnthropicProvider();
    await provider.complete({ messages: [{ role: "user", content: "uno" }] });
    await provider.complete({ messages: [{ role: "user", content: "dos" }] });

    expect(MockAnthropic).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("declara su nombre como 'anthropic'", () => {
    expect(createAnthropicProvider().name).toBe("anthropic");
  });
});
