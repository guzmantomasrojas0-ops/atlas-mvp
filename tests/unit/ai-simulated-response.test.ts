import { describe, expect, it } from "vitest";
import type { CompletionRequest } from "@/modules/ai/domain";
import { buildSimulatedResponse } from "@/modules/ai/providers";

function request(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    messages: [
      { role: "system", content: "Sos el asistente de una barbería." },
      { role: "user", content: "¿Tienen turno mañana?" },
    ],
    ...overrides,
  };
}

describe("buildSimulatedResponse", () => {
  it("incluye el nombre del proveedor en el contenido simulado", () => {
    const response = buildSimulatedResponse("anthropic", request());
    expect(response.message.content).toContain("anthropic");
  });

  it("hace eco del último mensaje del usuario", () => {
    const response = buildSimulatedResponse("openai", request());
    expect(response.message.content).toContain("¿Tienen turno mañana?");
  });

  it("usa el último mensaje de usuario, no uno anterior", () => {
    const response = buildSimulatedResponse(
      "gemini",
      request({
        messages: [
          { role: "user", content: "primero" },
          { role: "assistant", content: "respuesta intermedia" },
          { role: "user", content: "segundo" },
        ],
      }),
    );
    expect(response.message.content).toContain("segundo");
    expect(response.message.content).not.toContain("primero");
  });

  it("sin toolChoice forzado, nunca devuelve un toolCall", () => {
    const response = buildSimulatedResponse("openai", request());
    expect(response.toolCalls).toEqual([]);
  });

  it("responde con role 'assistant' y finishReason 'stop'", () => {
    const response = buildSimulatedResponse("openai", request());
    expect(response.message.role).toBe("assistant");
    expect(response.finishReason).toBe("stop");
  });

  it("no rompe si no hay ningún mensaje de usuario", () => {
    const response = buildSimulatedResponse("openai", request({ messages: [] }));
    expect(response.message.content).toContain("openai");
  });

  describe("con toolChoice forzando una tool puntual", () => {
    it("devuelve un toolCall para esa tool en vez de texto", () => {
      const response = buildSimulatedResponse(
        "openai",
        request({ toolChoice: { type: "tool", name: "classify_intent" } }),
      );

      expect(response.toolCalls).toEqual([
        { id: "simulated-classify_intent", name: "classify_intent", arguments: {} },
      ]);
      expect(response.finishReason).toBe("tool_calls");
    });

    it("los tres proveedores simulados se comportan igual ante el mismo toolChoice", () => {
      const forcedRequest = request({ toolChoice: { type: "tool", name: "classify_intent" } });

      const openai = buildSimulatedResponse("openai", forcedRequest);
      const anthropic = buildSimulatedResponse("anthropic", forcedRequest);
      const gemini = buildSimulatedResponse("gemini", forcedRequest);

      expect(openai.toolCalls).toEqual(anthropic.toolCalls);
      expect(anthropic.toolCalls).toEqual(gemini.toolCalls);
    });

    it("no fuerza un toolCall si toolChoice es 'auto' o 'none'", () => {
      const auto = buildSimulatedResponse("openai", request({ toolChoice: "auto" }));
      const none = buildSimulatedResponse("openai", request({ toolChoice: "none" }));

      expect(auto.toolCalls).toEqual([]);
      expect(none.toolCalls).toEqual([]);
    });
  });
});
