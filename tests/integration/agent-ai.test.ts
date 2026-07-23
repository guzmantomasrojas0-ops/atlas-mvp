import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AIService } from "@/modules/ai";
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  LanguageModel,
} from "@/modules/ai";
import { converseWithAgent } from "@/modules/agent";
import type { BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { findOrCreateConversation, listMessages } from "@/modules/conversation";
import { createAppointment } from "@/modules/scheduling";
import { addDays, todayInTimezone } from "@/modules/scheduling/domain";

const TIMEZONE = "America/Bogota";

function textResponse(content: string): CompletionResponse {
  return {
    message: { role: "assistant", content },
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "stop",
  };
}

function toolCallResponse(name: string, args: Record<string, unknown> = {}): CompletionResponse {
  const toolCalls = [{ id: `call-${name}`, name, arguments: args }];
  return {
    message: { role: "assistant", content: "", toolCalls },
    toolCalls,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "tool_calls",
  };
}

/** Un modelo con guión: devuelve la próxima respuesta de la lista en cada llamada. */
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

/** Un modelo que siempre pide la misma tool con los mismos argumentos — nunca llega a una respuesta. */
function stuckModel(toolName: string): LanguageModel {
  return { name: "anthropic", complete: async () => toolCallResponse(toolName) };
}

/** Un modelo que pide una tool distinta (con args distintos) en cada vuelta — nunca se repite, nunca termina. */
function neverEndingModel(): LanguageModel {
  let call = 0;
  return {
    name: "anthropic",
    async complete(): Promise<CompletionResponse> {
      call += 1;
      return toolCallResponse("FIND_SERVICE", { query: `intento-${call}` });
    },
  };
}

let business: BusinessRef;
let businessId: string;
let conversationId: string;

beforeEach(async () => {
  const created = await createBusiness({
    name: "Negocio de prueba (agent ai)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  business = { id: created.id, name: created.name, timezone: created.timezone };
  businessId = created.id;

  const service = await createService(businessId, {
    name: "Corte de pelo",
    price: 25000,
    durationMinutes: 30,
  });
  const staff = await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });

  const appointment = await createAppointment(businessId, TIMEZONE, {
    staffId: staff.id,
    serviceId: service.id,
    clientName: "María Gómez",
    clientPhone: "+57 301 555 0101",
    date: addDays(todayInTimezone(TIMEZONE), 3),
    time: "10:00",
  });

  const conversation = await findOrCreateConversation(businessId, appointment.clientId, "WHATSAPP");
  conversationId = conversation.id;
});

afterEach(async () => {
  await db.message.deleteMany({ where: { conversation: { businessId } } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("converseWithAgent — loop conversacional completo con datos reales (modelo simulado, sin red)", () => {
  it("responde en texto sin necesitar ninguna tool, y persiste la respuesta como mensaje de AGENT", async () => {
    const aiService = new AIService(
      scriptedModel([textResponse("¡Hola María! ¿En qué te ayudo?")]),
    );

    const result = await converseWithAgent(business, conversationId, "Hola!", aiService);

    expect(result.stopReason).toBe("final_response");
    expect(result.response).toBe("¡Hola María! ¿En qué te ayudo?");
    expect(result.steps).toEqual([]);

    const messages = await listMessages(conversationId);
    const lastMessage = messages.at(-1);
    expect(lastMessage?.sender).toBe("AGENT");
    expect(lastMessage?.content).toBe("¡Hola María! ¿En qué te ayudo?");
  });

  it("pide una tool real, recibe el resultado del Execution Engine, y responde con esa info", async () => {
    const aiService = new AIService(
      scriptedModel([
        toolCallResponse("FIND_SERVICE", { query: "corte" }),
        textResponse("El corte de pelo sale $25.000 y dura 30 minutos."),
      ]),
    );

    const result = await converseWithAgent(
      business,
      conversationId,
      "¿Cuánto sale el corte?",
      aiService,
    );

    expect(result.stopReason).toBe("final_response");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolName).toBe("FIND_SERVICE");
    expect(result.steps[0].result).toMatchObject({
      success: true,
      payload: { services: [{ name: "Corte de pelo", price: 25000 }] },
    });

    const messages = await listMessages(conversationId);
    expect(messages.at(-1)?.content).toBe("El corte de pelo sale $25.000 y dura 30 minutos.");
  });

  it("nunca deja que el modelo complete businessId/clientId — el contexto siempre gana", async () => {
    let capturedArgs: Record<string, unknown> | undefined;
    const aiService = new AIService({
      name: "anthropic",
      async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const lastMessage = request.messages.at(-1) as ChatMessage;
        if (lastMessage.role === "tool") return textResponse("Listo.");
        // El modelo "intenta" mandar un businessId ajeno — no debería importar.
        capturedArgs = { query: "corte", businessId: "spoofed-business-id" };
        return toolCallResponse("FIND_SERVICE", capturedArgs);
      },
    });

    const result = await converseWithAgent(
      business,
      conversationId,
      "¿precio del corte?",
      aiService,
    );

    expect(result.steps[0].input).toMatchObject({ businessId });
    expect(result.steps[0].result.success).toBe(true);
  });

  it("herramienta inexistente: el Execution Engine la reporta como TOOL_NOT_FOUND, sin romper el loop", async () => {
    const aiService = new AIService(
      scriptedModel([
        toolCallResponse("HERRAMIENTA_QUE_NO_EXISTE"),
        textResponse("No pude encontrar esa información."),
      ]),
    );

    const result = await converseWithAgent(business, conversationId, "algo raro", aiService);

    expect(result.steps[0].result).toMatchObject({
      success: false,
      error: { code: "TOOL_NOT_FOUND" },
    });
    expect(result.stopReason).toBe("final_response");
  });

  it("corta con 'repeated_tool_call' si el modelo pide la misma tool con los mismos argumentos indefinidamente", async () => {
    const aiService = new AIService(stuckModel("FIND_SERVICE"));

    const result = await converseWithAgent(business, conversationId, "mensaje", aiService);

    expect(result.stopReason).toBe("repeated_tool_call");
    expect(result.response).toBeNull();

    const messages = await listMessages(conversationId);
    expect(messages.every((m) => m.sender !== "AGENT")).toBe(true);
  });

  it("corta con 'max_iterations' si el modelo nunca deja de pedir tools distintas", async () => {
    const aiService = new AIService(neverEndingModel());

    const result = await converseWithAgent(business, conversationId, "mensaje", aiService);

    expect(result.stopReason).toBe("max_iterations");
    expect(result.response).toBeNull();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it("corta con 'empty_response' si el modelo no pide tools y responde vacío, sin persistir nada", async () => {
    const aiService = new AIService(scriptedModel([textResponse("   ")]));

    const result = await converseWithAgent(business, conversationId, "mensaje", aiService);

    expect(result.stopReason).toBe("empty_response");
    expect(result.response).toBeNull();

    const messages = await listMessages(conversationId);
    expect(messages.every((m) => m.sender !== "AGENT")).toBe(true);
  });
});
