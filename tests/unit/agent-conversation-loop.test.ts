import { z } from "zod";
import { describe, expect, it } from "vitest";
import { AIService } from "@/modules/ai";
import type {
  CompletionRequest,
  CompletionResponse,
  LanguageModel,
  ToolDefinition,
} from "@/modules/ai";
import {
  runConversationLoop,
  ToolRegistry,
  type AgentContext,
  type Tool,
} from "@/modules/agent/domain";

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    businessId: "biz-1",
    businessName: "Barbería El Buen Corte",
    businessTimezone: "America/Bogota",
    conversationId: "conv-1",
    clientId: "client-1",
    clientName: "María Gómez",
    services: [],
    staff: [],
    upcomingAppointments: [],
    pastAppointments: [],
    recentMessages: [],
    ...overrides,
  };
}

function textResponse(content: string): CompletionResponse {
  return {
    message: { role: "assistant", content },
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "stop",
  };
}

function toolCallResponse(name: string, args: Record<string, unknown> = {}): CompletionResponse {
  const toolCalls = [{ id: `call-${name}-${JSON.stringify(args)}`, name, arguments: args }];
  return {
    message: { role: "assistant", content: "", toolCalls },
    toolCalls,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "tool_calls",
  };
}

function scriptedModel(responses: CompletionResponse[]): LanguageModel {
  let call = 0;
  return {
    name: "anthropic",
    async complete(): Promise<CompletionResponse> {
      const response = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return response;
    },
  };
}

const echoTool: Tool = {
  name: "FIND_SERVICE",
  description: "Tool de prueba que devuelve lo que recibe.",
  inputSchema: z.object({ query: z.string().optional() }),
  execute: async (input) => ({ echoed: input }),
};

const failingTool: Tool = {
  name: "FIND_STAFF",
  description: "Tool de prueba que siempre falla.",
  inputSchema: z.unknown(),
  execute: async () => {
    throw new Error("boom");
  },
};

function registryWith(...tools: Tool[]): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of tools) registry.register(tool);
  return registry;
}

const toolDefinitions: ToolDefinition[] = [
  { name: "FIND_SERVICE", description: "eco", parameters: { type: "object" } },
];

function baseDeps(model: LanguageModel, registry: ToolRegistry) {
  return {
    aiService: new AIService(model),
    toolRegistry: registry,
    toolDefinitions,
    context: context(),
  };
}

describe("runConversationLoop", () => {
  it("responde en texto directamente si el modelo no pide ninguna tool", async () => {
    const result = await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(scriptedModel([textResponse("¡Hola! ¿En qué te ayudo?")]), registryWith(echoTool)),
    );

    expect(result.stopReason).toBe("final_response");
    expect(result.response).toBe("¡Hola! ¿En qué te ayudo?");
    expect(result.steps).toEqual([]);
    expect(result.messages.at(-1)).toEqual({
      role: "assistant",
      content: "¡Hola! ¿En qué te ayudo?",
    });
  });

  it("ejecuta la tool pedida, agrega el resultado al historial, y vuelve a preguntar al modelo", async () => {
    const model = scriptedModel([
      toolCallResponse("FIND_SERVICE", { query: "corte" }),
      textResponse("Listo."),
    ]);

    const result = await runConversationLoop(
      [{ role: "user", content: "¿tienen corte?" }],
      baseDeps(model, registryWith(echoTool)),
    );

    expect(result.stopReason).toBe("final_response");
    expect(result.response).toBe("Listo.");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      toolName: "FIND_SERVICE",
      result: { success: true, payload: { echoed: { query: "corte" } } },
    });

    // El historial que se re-envía tiene que incluir el tool_use del asistente Y el tool_result.
    const roles = result.messages.map((m) => m.role);
    expect(roles).toEqual(["user", "assistant", "tool", "assistant"]);
  });

  it("aplica los defaults de contexto sobre el input que manda el modelo antes de ejecutar", async () => {
    const model = scriptedModel([
      toolCallResponse("FIND_SERVICE", { query: "corte" }),
      textResponse("Listo."),
    ]);

    const result = await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(model, registryWith(echoTool)),
    );

    // FIND_SERVICE inyecta businessId desde el contexto — no viene del modelo.
    expect(result.steps[0].input).toMatchObject({ businessId: "biz-1" });
  });

  it("una tool inexistente se reporta como TOOL_NOT_FOUND sin cortar el loop", async () => {
    const model = scriptedModel([
      toolCallResponse("NO_EXISTE"),
      textResponse("No encontré esa herramienta."),
    ]);

    const result = await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(model, registryWith(echoTool)),
    );

    expect(result.steps[0].result).toMatchObject({
      success: false,
      error: { code: "TOOL_NOT_FOUND" },
    });
    expect(result.stopReason).toBe("final_response");
  });

  it("una tool que tira una excepción se reporta como error estructurado, sin propagar la excepción", async () => {
    const model = scriptedModel([toolCallResponse("FIND_STAFF"), textResponse("Uy, algo falló.")]);

    const result = await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(model, registryWith(failingTool)),
    );

    expect(result.steps[0].result).toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(result.stopReason).toBe("final_response");
  });

  it("corta con 'empty_response' si el modelo no pide tools y responde vacío", async () => {
    const result = await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(scriptedModel([textResponse("   ")]), registryWith(echoTool)),
    );

    expect(result.stopReason).toBe("empty_response");
    expect(result.response).toBeNull();
  });

  it("corta con 'repeated_tool_call' si la misma tool con los mismos argumentos se repite de más", async () => {
    const model: LanguageModel = {
      name: "anthropic",
      complete: async () => toolCallResponse("FIND_SERVICE", { query: "siempre igual" }),
    };

    const result = await runConversationLoop([{ role: "user", content: "hola" }], {
      ...baseDeps(model, registryWith(echoTool)),
      limits: { maxRepeatedToolCalls: 2, maxIterations: 20 },
    });

    expect(result.stopReason).toBe("repeated_tool_call");
    expect(result.response).toBeNull();
    // Se ejecuta hasta el límite (2 veces), la 3ra ya ni se corre.
    expect(result.steps).toHaveLength(2);
  });

  it("no corta por repetición si los argumentos cambian entre llamadas", async () => {
    let call = 0;
    const model: LanguageModel = {
      name: "anthropic",
      async complete() {
        call += 1;
        if (call > 3) return textResponse("Listo.");
        return toolCallResponse("FIND_SERVICE", { query: `intento-${call}` });
      },
    };

    const result = await runConversationLoop([{ role: "user", content: "hola" }], {
      ...baseDeps(model, registryWith(echoTool)),
      limits: { maxRepeatedToolCalls: 2, maxIterations: 10 },
    });

    expect(result.stopReason).toBe("final_response");
    expect(result.steps).toHaveLength(3);
  });

  it("corta con 'max_iterations' si el modelo nunca deja de pedir tools con argumentos distintos", async () => {
    let call = 0;
    const model: LanguageModel = {
      name: "anthropic",
      async complete() {
        call += 1;
        return toolCallResponse("FIND_SERVICE", { query: `intento-${call}` });
      },
    };

    const result = await runConversationLoop([{ role: "user", content: "hola" }], {
      ...baseDeps(model, registryWith(echoTool)),
      limits: { maxIterations: 3, maxRepeatedToolCalls: 10 },
    });

    expect(result.stopReason).toBe("max_iterations");
    expect(result.response).toBeNull();
    expect(result.steps).toHaveLength(3);
  });

  it("manda toolChoice: 'auto' y las tools disponibles en cada llamada al modelo", async () => {
    const requests: CompletionRequest[] = [];
    const model: LanguageModel = {
      name: "anthropic",
      async complete(request) {
        requests.push(request);
        return textResponse("Listo.");
      },
    };

    await runConversationLoop(
      [{ role: "user", content: "hola" }],
      baseDeps(model, registryWith(echoTool)),
    );

    expect(requests[0].toolChoice).toBe("auto");
    expect(requests[0].tools).toEqual(toolDefinitions);
  });
});
