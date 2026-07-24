import { db } from "@/lib/db";
import type { ConversationChannelValue } from "../domain";

/** Conversaciones de un negocio, con el cliente y su último mensaje — para la lista lateral. */
export function listConversationsByBusiness(businessId: string) {
  return db.conversation.findMany({
    where: { businessId },
    include: {
      client: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** Conversaciones de un cliente puntual, con su último mensaje — para su historial en la ficha de Cliente. */
export function listConversationsByClient(businessId: string, clientId: string) {
  return db.conversation.findMany({
    where: { businessId, clientId },
    include: {
      client: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function findConversationById(businessId: string, id: string) {
  return db.conversation.findFirst({
    where: { id, businessId },
    include: { client: true },
  });
}

/**
 * Solo toca `lastReadAt`. Un `db.conversation.update()` normal dispara el
 * `@updatedAt` automático de Prisma aunque no esté en `data`, y eso pisaría
 * `updatedAt` — el campo por el que se ordena la lista — haciendo que abrir
 * una conversación vieja la mande al principio del inbox como si fuera la
 * más reciente.
 */
export function markConversationAsRead(id: string) {
  return db.$executeRaw`UPDATE "conversations" SET "lastReadAt" = ${new Date()} WHERE id = ${id}`;
}

/**
 * Encuentra la conversación abierta de un cliente en un canal, o crea una
 * nueva. Es el punto de entrada que va a usar un futuro webhook de canal
 * (WhatsApp/Instagram/SMS) — todavía no hay ninguno conectado.
 */
export function findOrCreateConversation(
  businessId: string,
  clientId: string,
  channel: ConversationChannelValue,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.conversation.findFirst({
      where: { businessId, clientId, channel },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing;
    return tx.conversation.create({ data: { businessId, clientId, channel } });
  });
}
