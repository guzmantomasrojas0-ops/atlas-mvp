import { listServices, listStaffMembers } from "@/modules/catalog";
import { getConversation, listMessages } from "@/modules/conversation";
import { getAppointmentsByClient } from "@/modules/scheduling";
import type { RawAgentContextInputs } from "../domain";

/**
 * Lo mínimo que este módulo necesita saber del negocio. No se resuelve acá
 * adentro (nada de `getFirstBusiness()`) — lo provee quien llama, igual que
 * `createAppointment(businessId, businessTimezone, ...)` en scheduling. Así
 * este módulo nunca asume cuál es "el" negocio, solo confía en el que le
 * pasan.
 */
export interface BusinessRef {
  id: string;
  name: string;
  timezone: string;
}

/**
 * Reúne los datos crudos de los demás módulos para una conversación
 * puntual. Es la única pieza del motor que hace I/O — mapea los tipos de
 * cada módulo a las formas propias del agente (`ServiceSummary`,
 * `AppointmentSummary`, etc.) para que el dominio del agente no dependa de
 * cómo esos módulos representan sus datos internamente.
 */
export async function fetchRawAgentContext(
  business: BusinessRef,
  conversationId: string,
): Promise<RawAgentContextInputs> {
  const conversation = await getConversation(business.id, conversationId);

  const [services, staff, appointments, messages] = await Promise.all([
    listServices(business.id),
    listStaffMembers(business.id),
    getAppointmentsByClient(business.id, conversation.clientId),
    listMessages(conversationId),
  ]);

  return {
    businessId: business.id,
    businessName: business.name,
    businessTimezone: business.timezone,
    conversationId,
    clientId: conversation.clientId,
    clientName: conversation.clientName,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      price: service.price,
      durationMinutes: service.durationMinutes,
    })),
    staff: staff.map((member) => ({ id: member.id, name: member.name, role: member.role })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      serviceName: appointment.serviceName,
      staffName: appointment.staffName,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
    })),
    recentMessages: messages.map((message) => ({
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
}
