import { describe, expect, it } from "vitest";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { ChatMessage, CompletionRequest } from "@/modules/ai/domain";
import {
  fromAnthropicMessage,
  toAnthropicMessages,
  toAnthropicRequestParams,
  toAnthropicSystem,
  toAnthropicToolChoice,
  toAnthropicTools,
} from "@/modules/ai/providers";

describe("toAnthropicSystem", () => {
  it("junta los mensajes 'system' en un solo bloque de texto, marcado para cachear", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "Primera instrucción." },
      { role: "user", content: "hola" },
      { role: "system", content: "Segunda instrucción." },
    ];
    expect(toAnthropicSystem(messages)).toEqual([
      {
        type: "text",
        text: "Primera instrucción.\n\nSegunda instrucción.",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("devuelve undefined si no hay ningún mensaje 'system'", () => {
    expect(toAnthropicSystem([{ role: "user", content: "hola" }])).toBeUndefined();
  });
});

describe("toAnthropicMessages", () => {
  it("excluye los mensajes 'system' — van aparte, no en el array de mensajes", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "instrucción" },
      { role: "user", content: "hola" },
    ];
    expect(toAnthropicMessages(messages)).toEqual([{ role: "user", content: "hola" }]);
  });

  it("mapea 'user' y 'assistant' directamente", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hola" },
      { role: "assistant", content: "¿en qué te ayudo?" },
    ];
    expect(toAnthropicMessages(messages)).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "¿en qué te ayudo?" },
    ]);
  });

  it("un mensaje 'tool' se traduce a un mensaje 'user' con un bloque tool_result", () => {
    const messages: ChatMessage[] = [
      { role: "tool", content: "resultado de la tool", toolCallId: "call-1" },
    ];
    expect(toAnthropicMessages(messages)).toEqual([
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "call-1", content: "resultado de la tool" }],
      },
    ]);
  });
});

describe("toAnthropicTools", () => {
  it("devuelve undefined si no hay tools", () => {
    expect(toAnthropicTools(undefined)).toBeUndefined();
    expect(toAnthropicTools([])).toBeUndefined();
  });

  it("mapea name/description/parameters a name/description/input_schema", () => {
    const tools = toAnthropicTools([
      {
        name: "classify_intent",
        description: "Clasifica el intent",
        parameters: {
          type: "object",
          properties: { intent: { type: "string" } },
          required: ["intent"],
        },
      },
    ]);
    expect(tools).toEqual([
      {
        name: "classify_intent",
        description: "Clasifica el intent",
        input_schema: {
          type: "object",
          properties: { intent: { type: "string" } },
          required: ["intent"],
        },
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("marca cache_control solo en la última tool — cachea el bloque completo hasta ahí, no cada una por separado", () => {
    const tools = toAnthropicTools([
      { name: "first", description: "primera", parameters: { type: "object" } },
      { name: "second", description: "segunda", parameters: { type: "object" } },
    ]);
    expect(tools?.[0]).not.toHaveProperty("cache_control");
    expect(tools?.[1]).toMatchObject({ cache_control: { type: "ephemeral" } });
  });
});

describe("toAnthropicToolChoice", () => {
  it("undefined o 'auto' se traducen a {type: 'auto'}", () => {
    expect(toAnthropicToolChoice(undefined)).toEqual({ type: "auto" });
    expect(toAnthropicToolChoice("auto")).toEqual({ type: "auto" });
  });

  it("'none' se traduce a {type: 'none'}", () => {
    expect(toAnthropicToolChoice("none")).toEqual({ type: "none" });
  });

  it("{type: 'tool', name} se traduce igual, forzando esa tool puntual", () => {
    expect(toAnthropicToolChoice({ type: "tool", name: "classify_intent" })).toEqual({
      type: "tool",
      name: "classify_intent",
    });
  });
});

describe("toAnthropicRequestParams", () => {
  it("arma los parámetros completos a partir de un CompletionRequest", () => {
    const request: CompletionRequest = {
      messages: [
        { role: "system", content: "Sos un clasificador." },
        { role: "user", content: "hola" },
      ],
      tools: [
        { name: "classify_intent", description: "clasifica", parameters: { type: "object" } },
      ],
      toolChoice: { type: "tool", name: "classify_intent" },
      maxOutputTokens: 512,
    };

    const params = toAnthropicRequestParams(request, "claude-haiku-4-5-20251001");

    expect(params.model).toBe("claude-haiku-4-5-20251001");
    expect(params.max_tokens).toBe(512);
    expect(params.system).toEqual([
      { type: "text", text: "Sos un clasificador.", cache_control: { type: "ephemeral" } },
    ]);
    expect(params.messages).toEqual([{ role: "user", content: "hola" }]);
    expect(params.tool_choice).toEqual({ type: "tool", name: "classify_intent" });
  });

  it("usa 1024 tokens por defecto si no se especifica maxOutputTokens", () => {
    const params = toAnthropicRequestParams(
      { messages: [{ role: "user", content: "hola" }] },
      "claude-haiku-4-5-20251001",
    );
    expect(params.max_tokens).toBe(1024);
  });
});

describe("fromAnthropicMessage", () => {
  function anthropicMessage(
    overrides: Partial<Anthropic.Messages.Message> = {},
  ): Anthropic.Messages.Message {
    return {
      id: "msg-1",
      container: null,
      content: [{ type: "text", text: "hola, ¿en qué te ayudo?", citations: null }],
      model: "claude-haiku-4-5-20251001",
      role: "assistant",
      stop_details: null,
      stop_reason: "end_turn",
      stop_sequence: null,
      type: "message",
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

  it("mapea un bloque de texto al mensaje de respuesta", () => {
    const response = fromAnthropicMessage(anthropicMessage());
    expect(response.message).toEqual({ role: "assistant", content: "hola, ¿en qué te ayudo?" });
    expect(response.toolCalls).toEqual([]);
  });

  it("mapea un bloque tool_use a un ToolCall", () => {
    const response = fromAnthropicMessage(
      anthropicMessage({
        content: [
          {
            type: "tool_use",
            id: "call-1",
            name: "classify_intent",
            input: { intent: "ASK_PRICE" },
            caller: { type: "direct" },
          },
        ],
        stop_reason: "tool_use",
      }),
    );

    expect(response.toolCalls).toEqual([
      { id: "call-1", name: "classify_intent", arguments: { intent: "ASK_PRICE" } },
    ]);
    expect(response.finishReason).toBe("tool_calls");
  });

  it("mapea el usage real de la API", () => {
    const response = fromAnthropicMessage(anthropicMessage());
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it.each([
    ["end_turn", "stop"],
    ["stop_sequence", "stop"],
    ["pause_turn", "stop"],
    ["tool_use", "tool_calls"],
    ["max_tokens", "length"],
    ["refusal", "content_filter"],
  ] as const)("mapea stop_reason %s a finishReason %s", (stopReason, expectedFinishReason) => {
    const response = fromAnthropicMessage(anthropicMessage({ stop_reason: stopReason }));
    expect(response.finishReason).toBe(expectedFinishReason);
  });
});
