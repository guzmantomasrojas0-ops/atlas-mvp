import {
  ConversationNotFoundError,
  isConversationUnread,
  sendMessageInputSchema,
  type ConversationChannelValue,
  type MessageSenderValue,
} from "./domain";
import {
  createMessage as createMessageRecord,
  findConversationById,
  findOrCreateConversation as findOrCreateConversationRecord,
  listConversationsByBusiness,
  listMessagesByConversation,
  markConversationAsRead,
} from "./data";

export interface ConversationListItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  channel: ConversationChannelValue;
  lastMessagePreview: string | null;
  lastMessageAt: Date;
  unread: boolean;
}

export interface ConversationDetail {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  channel: ConversationChannelValue;
  createdAt: Date;
  clientSince: Date;
}

export interface MessageItem {
  id: string;
  sender: MessageSenderValue;
  content: string;
  createdAt: Date;
}

/** Conversaciones de un negocio para la lista lateral, más recientes primero. */
export async function listConversations(businessId: string): Promise<ConversationListItem[]> {
  const conversations = await listConversationsByBusiness(businessId);
  return conversations.map((conversation) => {
    const lastMessage = conversation.messages[0] ?? null;
    return {
      id: conversation.id,
      clientId: conversation.clientId,
      clientName: conversation.client.name,
      clientPhone: conversation.client.phone,
      channel: conversation.channel as ConversationChannelValue,
      lastMessagePreview: lastMessage?.content ?? null,
      lastMessageAt: lastMessage?.createdAt ?? conversation.createdAt,
      unread: isConversationUnread(conversation.lastReadAt, lastMessage),
    };
  });
}

/** Datos de una conversación puntual, acotada al negocio (evita fugas entre tenants). */
export async function getConversation(businessId: string, id: string): Promise<ConversationDetail> {
  const conversation = await findConversationById(businessId, id);
  if (!conversation) throw new ConversationNotFoundError();
  return {
    id: conversation.id,
    clientId: conversation.clientId,
    clientName: conversation.client.name,
    clientPhone: conversation.client.phone,
    channel: conversation.channel as ConversationChannelValue,
    createdAt: conversation.createdAt,
    clientSince: conversation.client.createdAt,
  };
}

/** Mensajes de una conversación, del más viejo al más nuevo. */
export async function listMessages(conversationId: string): Promise<MessageItem[]> {
  const messages = await listMessagesByConversation(conversationId);
  return messages.map((message) => ({
    id: message.id,
    sender: message.sender as MessageSenderValue,
    content: message.content,
    createdAt: message.createdAt,
  }));
}

/**
 * Envía un mensaje dentro de una conversación. `sender` por defecto es STAFF
 * porque hoy el único origen es el composer del dashboard — un futuro
 * agente de IA pasaría "AGENT" acá, y un futuro webhook de canal pasaría
 * "CLIENT". Enviar (STAFF/AGENT) marca la conversación como leída: no se
 * puede responder algo que no se vio.
 */
export async function sendMessage(
  businessId: string,
  conversationId: string,
  content: string,
  sender: MessageSenderValue = "STAFF",
) {
  const data = sendMessageInputSchema.parse({ conversationId, content });
  await getConversation(businessId, data.conversationId); // valida pertenencia al negocio

  const message = await createMessageRecord(data.conversationId, sender, data.content);
  if (sender !== "CLIENT") {
    await markConversationAsRead(data.conversationId);
  }
  return message;
}

/** Marca una conversación como vista — se dispara al abrirla, no al renderizarla (ver README). */
export async function markAsRead(businessId: string, conversationId: string): Promise<void> {
  await getConversation(businessId, conversationId); // valida pertenencia al negocio
  await markConversationAsRead(conversationId);
}

/** Encuentra o crea la conversación de un cliente en un canal — usado por el seed y, a futuro, por webhooks de canal. */
export async function findOrCreateConversation(
  businessId: string,
  clientId: string,
  channel: ConversationChannelValue,
) {
  return findOrCreateConversationRecord(businessId, clientId, channel);
}
