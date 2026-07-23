import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AIService } from "@/modules/ai";
import type { CompletionResponse, LanguageModel } from "@/modules/ai";
import { converseWithAgent } from "@/modules/agent";
import type { BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { findOrCreateConversation, listMessages, sendMessage } from "@/modules/conversation";
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
  return {
    message: { role: "assistant", content: "" },
    toolCalls: [{ id: `call-${name}`, name, arguments: args }],
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

let business: BusinessRef;
let businessId: string;
let conversationId: string;
let corteId: string;
let juanId: string;
let anaId: string;
let tomorrow: string;

beforeEach(async () => {
  const created = await createBusiness({
    name: "Barbería Sprint 13",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  business = { id: created.id, name: created.name, timezone: created.timezone };
  businessId = created.id;

  const corte = await createService(businessId, {
    name: "Corte de pelo",
    price: 25000,
    durationMinutes: 30,
  });
  corteId = corte.id;

  const juan = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });
  juanId = juan.id;
  const ana = await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });
  anaId = ana.id;

  const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
  const conversation = await findOrCreateConversation(businessId, client.id, "WHATSAPP");
  conversationId = conversation.id;

  tomorrow = addDays(todayInTimezone(TIMEZONE), 1);
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

describe("Sprint 13/14 — conversación completa de reserva, hasta crear la cita real", () => {
  it("reproduce el ejemplo del brief de punta a punta, con el mismo Conversation Loop del Sprint 12", async () => {
    // Turno 1: "Quiero un corte mañana." → ATLAS busca el servicio y pregunta por el profesional.
    await sendMessage(businessId, conversationId, "Quiero un corte mañana.", "CLIENT");
    const turn1 = await converseWithAgent(
      business,
      conversationId,
      "Quiero un corte mañana.",
      new AIService(
        scriptedModel([
          toolCallResponse("FIND_SERVICE", { query: "corte" }),
          textResponse("¿Con qué profesional?"),
        ]),
      ),
    );

    expect(turn1.stopReason).toBe("final_response");
    expect(turn1.response).toBe("¿Con qué profesional?");
    expect(turn1.steps).toHaveLength(1);
    expect(turn1.steps[0].toolName).toBe("FIND_SERVICE");
    expect(turn1.steps[0].result).toMatchObject({
      success: true,
      payload: { services: [{ id: corteId, name: "Corte de pelo" }] },
    });

    // Turno 2: "Con Juan." → ATLAS ubica a Juan, busca su disponibilidad, y ofrece horarios.
    await sendMessage(businessId, conversationId, "Con Juan.", "CLIENT");
    const turn2 = await converseWithAgent(
      business,
      conversationId,
      "Con Juan.",
      new AIService(
        scriptedModel([
          toolCallResponse("FIND_STAFF", { query: "Juan" }),
          toolCallResponse("SEARCH_AVAILABILITY", {
            date: tomorrow,
            serviceDurationMinutes: 30,
            staffId: juanId,
          }),
          textResponse("Juan tiene disponibilidad a las 2:00 PM y 4:30 PM."),
        ]),
      ),
    );

    expect(turn2.stopReason).toBe("final_response");
    expect(turn2.response).toBe("Juan tiene disponibilidad a las 2:00 PM y 4:30 PM.");
    expect(turn2.steps.map((step) => step.toolName)).toEqual(["FIND_STAFF", "SEARCH_AVAILABILITY"]);
    expect(turn2.steps[0].result).toMatchObject({
      success: true,
      // Búsqueda real por nombre: entre Juan y Ana, solo Juan matchea "Juan".
      payload: { staff: [{ id: juanId, name: "Juan Pérez" }] },
    });
    expect(
      (turn2.steps[0].result.payload as { staff: { id: string }[] }).staff.map((s) => s.id),
    ).not.toContain(anaId);
    const availabilityPayload = turn2.steps[1].result.payload as {
      availability: { staffId: string; slots: unknown[] }[];
    };
    expect(availabilityPayload.availability[0].staffId).toBe(juanId);
    expect(availabilityPayload.availability.map((a) => a.staffId)).not.toContain(anaId);
    expect(availabilityPayload.availability[0].slots.length).toBeGreaterThan(0);

    // Turno 3: "2 PM." → ATLAS arma el resumen estructurado, sin guardar nada, y pregunta si confirma.
    await sendMessage(businessId, conversationId, "2 PM.", "CLIENT");
    const resumen = [
      "Perfecto. Este es el resumen de tu cita:",
      "- Servicio: Corte de pelo",
      "- Profesional: Juan Pérez",
      `- Fecha: ${tomorrow}`,
      "- Hora: 14:00",
      "",
      "¿Confirmás la reserva?",
    ].join("\n");
    const turn3 = await converseWithAgent(
      business,
      conversationId,
      "2 PM.",
      new AIService(
        scriptedModel([
          toolCallResponse("PREPARE_BOOKING_SUMMARY", {
            serviceId: corteId,
            staffId: juanId,
            date: tomorrow,
            time: "14:00",
          }),
          textResponse(resumen),
        ]),
      ),
    );

    expect(turn3.stopReason).toBe("final_response");
    expect(turn3.response).toBe(resumen);
    expect(turn3.steps).toHaveLength(1);
    expect(turn3.steps[0].toolName).toBe("PREPARE_BOOKING_SUMMARY");
    expect(turn3.steps[0].result).toMatchObject({
      success: true,
      payload: {
        summary: {
          service: { id: corteId, name: "Corte de pelo" },
          staff: { id: juanId, name: "Juan Pérez" },
          date: tomorrow,
          time: "14:00",
          isAvailable: true,
        },
      },
    });

    // Todavía no se creó ninguna cita real — solo se armó y mostró el resumen.
    expect(await db.appointment.count({ where: { businessId } })).toBe(0);

    // Turno 4: "Sí." → recién ahora ATLAS llama a CREATE_APPOINTMENT y crea la cita real.
    await sendMessage(businessId, conversationId, "Sí.", "CLIENT");
    const confirmacion = "✅ Tu cita quedó confirmada. ¡Te esperamos!";
    const turn4 = await converseWithAgent(
      business,
      conversationId,
      "Sí.",
      new AIService(
        scriptedModel([
          toolCallResponse("CREATE_APPOINTMENT", {
            serviceId: corteId,
            staffId: juanId,
            date: tomorrow,
            time: "14:00",
          }),
          textResponse(confirmacion),
        ]),
      ),
    );

    expect(turn4.stopReason).toBe("final_response");
    expect(turn4.response).toBe(confirmacion);
    expect(turn4.steps).toHaveLength(1);
    expect(turn4.steps[0].toolName).toBe("CREATE_APPOINTMENT");
    expect(turn4.steps[0].result).toMatchObject({
      success: true,
      payload: {
        appointment: {
          service: { id: corteId, name: "Corte de pelo" },
          staff: { id: juanId, name: "Juan Pérez" },
        },
      },
    });

    // El contexto de los 4 turnos quedó en la conversación real — nada se perdió entre mensajes.
    const messages = await listMessages(conversationId);
    expect(messages.map((message) => `${message.sender}: ${message.content}`)).toEqual([
      "CLIENT: Quiero un corte mañana.",
      "AGENT: ¿Con qué profesional?",
      "CLIENT: Con Juan.",
      "AGENT: Juan tiene disponibilidad a las 2:00 PM y 4:30 PM.",
      "CLIENT: 2 PM.",
      `AGENT: ${resumen}`,
      "CLIENT: Sí.",
      `AGENT: ${confirmacion}`,
    ]);

    // Ahora sí existe exactamente una cita real, y le pertenece al negocio y al cliente correctos.
    const appointments = await db.appointment.findMany({ where: { businessId } });
    expect(appointments).toHaveLength(1);
    expect(appointments[0]).toMatchObject({
      businessId,
      staffId: juanId,
      serviceId: corteId,
    });

    const client = await db.client.findFirst({ where: { businessId } });
    expect(appointments[0].clientId).toBe(client?.id);
  });
});
