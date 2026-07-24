import { db } from "@/lib/db";
import type { MessageSenderValue } from "../domain";

export function listMessagesByConversation(conversationId: string) {
  return db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Crea un mensaje y actualiza `updatedAt` de la conversación en la misma
 * transacción — así la lista lateral puede ordenar por actividad reciente
 * con un simple `orderBy: updatedAt`, sin tener que hacer join con mensajes.
 */
export function createMessage(
  conversationId: string,
  sender: MessageSenderValue,
  content: string,
  externalMessageId?: string,
) {
  return db.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, sender, content, externalMessageId },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  });
}

/** ¿Ya existe un mensaje con este id de canal externo? La clave de idempotencia real ante reentregas duplicadas de un webhook (ver comentario en el schema). */
export function findMessageByExternalId(externalMessageId: string) {
  return db.message.findUnique({ where: { externalMessageId } });
}
