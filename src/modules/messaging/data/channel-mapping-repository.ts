import { db } from "@/lib/db";
import type { ConversationChannelValue } from "@/modules/conversation";
import { defaultClientName, isPhoneBasedChannel } from "../domain";

/**
 * Resuelve cómo un `externalConversationId` de un canal externo se
 * relaciona con una Conversation interna: si ya existe un `ChannelMapping`
 * para ese negocio+canal+id externo, reutiliza la Conversation que apunta;
 * si no, crea un Client provisional, una Conversation, y el mapping que los
 * une — todo en una sola transacción. Esta es la única puerta de entrada
 * para crear un Client/Conversation a partir de un mensaje externo; el
 * resto de `messaging/` no toca Prisma directamente.
 */
export async function findOrCreateMappedConversation(
  businessId: string,
  channel: ConversationChannelValue,
  externalConversationId: string,
  externalUserId: string,
): Promise<string> {
  const existing = await db.channelMapping.findUnique({
    where: {
      businessId_channel_externalConversationId: { businessId, channel, externalConversationId },
    },
  });
  if (existing) return existing.conversationId;

  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        businessId,
        name: defaultClientName(channel, externalUserId),
        phone: isPhoneBasedChannel(channel) ? externalUserId : null,
      },
    });
    const conversation = await tx.conversation.create({
      data: { businessId, clientId: client.id, channel },
    });
    await tx.channelMapping.create({
      data: {
        businessId,
        channel,
        externalConversationId,
        externalUserId,
        conversationId: conversation.id,
      },
    });
    return conversation.id;
  });
}
