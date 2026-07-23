import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildAgentContext, processMessage, type BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import {
  ConversationNotFoundError,
  findOrCreateConversation,
  sendMessage,
} from "@/modules/conversation";
import { createAppointment } from "@/modules/scheduling";
import { addDays, todayInTimezone } from "@/modules/scheduling/domain";

const TIMEZONE = "America/Bogota";

let business: BusinessRef;
let businessId: string;
let clientId: string;
let conversationId: string;

beforeEach(async () => {
  const created = await createBusiness({
    name: "Negocio de prueba (agent)",
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
  clientId = appointment.clientId;

  const conversation = await findOrCreateConversation(businessId, clientId, "WHATSAPP");
  conversationId = conversation.id;
  await sendMessage(businessId, conversationId, "Hola, quería consultar por un turno", "CLIENT");
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

describe("agent module — integración con Postgres real", () => {
  it("buildAgentContext reúne servicios, equipo, reservas y mensajes reales", async () => {
    const context = await buildAgentContext(business, conversationId);

    expect(context.businessName).toBe("Negocio de prueba (agent)");
    expect(context.clientName).toBe("María Gómez");
    expect(context.services.map((s) => s.name)).toEqual(["Corte de pelo"]);
    expect(context.staff.map((s) => s.name)).toEqual(["Ana Gómez"]);
    expect(context.upcomingAppointments).toHaveLength(1);
    expect(context.upcomingAppointments[0].serviceName).toBe("Corte de pelo");
    expect(context.pastAppointments).toHaveLength(0);
    expect(context.recentMessages.map((m) => m.content)).toContain(
      "Hola, quería consultar por un turno",
    );
  });

  it("processMessage clasifica un saludo y no planea ninguna acción", async () => {
    const result = await processMessage(business, conversationId, "Hola, buenas!");

    expect(result.intent).toBe("GREETING");
    expect(result.decision.shouldEscalateToHuman).toBe(false);
    expect(result.plannedAction).toBeNull();
  });

  it("processMessage reconoce que se puede reservar, pero no ejecuta ninguna herramienta todavía", async () => {
    const result = await processMessage(business, conversationId, "Quiero reservar otro turno");

    expect(result.intent).toBe("BOOK_APPOINTMENT");
    expect(result.decision.canBook).toBe(true);
    // CREATE_RESERVATION escribe datos — todavía no existe, así que no hay plan.
    expect(result.plannedAction).toBeNull();
  });

  it("processMessage reconoce que se puede cancelar dado que hay una reserva próxima", async () => {
    const result = await processMessage(business, conversationId, "Quiero cancelar mi turno");

    expect(result.intent).toBe("CANCEL_APPOINTMENT");
    expect(result.decision.canCancel).toBe(true);
  });

  // Estas tres muestran el punto central del Sprint 9: con las herramientas
  // de solo lectura registradas desde el Sprint 8, el mismo mecanismo tabla
  // intent → tool + chequeo de política + chequeo de registro (sin ningún
  // caso especial en el pipeline) ahora planea Y ejecuta de punta a punta,
  // devolviendo datos reales de la base — sin generar ningún texto.
  it("processMessage planea y ejecuta GET_BUSINESS_HOURS para una consulta de horario", async () => {
    const result = await processMessage(business, conversationId, "¿A qué hora abren?");

    expect(result.intent).toBe("ASK_HOURS");
    expect(result.plannedAction).toEqual({
      tool: "GET_BUSINESS_HOURS",
      input: { businessName: business.name, businessTimezone: business.timezone },
      reason: result.decision.reason,
    });
    expect(result.execution).toMatchObject({
      success: true,
      toolName: "GET_BUSINESS_HOURS",
      payload: {
        businessName: business.name,
        timezone: business.timezone,
        openHour: 8,
        closeHour: 20,
      },
      error: null,
    });
  });

  it("processMessage planea y ejecuta FIND_SERVICE para una consulta de precio", async () => {
    const result = await processMessage(business, conversationId, "¿Cuánto cuesta el corte?");

    expect(result.intent).toBe("ASK_PRICE");
    expect(result.plannedAction).toEqual({
      tool: "FIND_SERVICE",
      input: { businessId: business.id },
      reason: result.decision.reason,
    });
    expect(result.execution?.success).toBe(true);
    expect(result.execution?.payload).toMatchObject({
      services: [{ name: "Corte de pelo", price: 25000, durationMinutes: 30 }],
    });
  });

  it("processMessage planea y ejecuta SEARCH_AVAILABILITY para una consulta de disponibilidad", async () => {
    const result = await processMessage(business, conversationId, "¿Qué horarios tienen mañana?");

    expect(result.intent).toBe("CHECK_AVAILABILITY");
    expect(result.plannedAction?.tool).toBe("SEARCH_AVAILABILITY");
    expect(result.execution?.success).toBe(true);

    const payload = result.execution?.payload as {
      availability: { staffId: string; slots: unknown[] }[];
    };
    expect(payload.availability).toHaveLength(1);
    // La única reserva existente es dentro de 3 días, no hoy — hoy queda libre todo el día.
    expect(payload.availability[0].slots.length).toBeGreaterThan(0);
  });

  it("si el mensaje no se puede clasificar, escala a humano y no ejecuta ninguna herramienta", async () => {
    const result = await processMessage(business, conversationId, "asdkjaslkdj sin sentido");

    expect(result.intent).toBe("OTHER");
    expect(result.decision.shouldEscalateToHuman).toBe(true);
    expect(result.plannedAction).toBeNull();
    expect(result.execution).toBeNull();
  });

  it("no deja construir contexto para una conversación de otro negocio", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 111 2222",
      address: "Otra calle 456",
      timezone: TIMEZONE,
      businessType: "SALON",
    });

    await expect(
      buildAgentContext(
        { id: otherBusiness.id, name: otherBusiness.name, timezone: otherBusiness.timezone },
        conversationId,
      ),
    ).rejects.toThrow(ConversationNotFoundError);

    await db.business.delete({ where: { id: otherBusiness.id } });
  });
});
