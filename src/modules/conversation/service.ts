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
  findMessageByExternalId,
  findOrCreateConversation as findOrCreateConversationRecord,
  listConversationsByBusiness,
  listConversationsByClient,
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

type ConversationWithLastMessage = Awaited<ReturnType<typeof listConversationsByBusiness>>[number];

function toConversationListItem(conversation: ConversationWithLastMessage): ConversationListItem {
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
}

/** Conversaciones de un negocio para la lista lateral, más recientes primero. */
export async function listConversations(businessId: string): Promise<ConversationListItem[]> {
  const conversations = await listConversationsByBusiness(businessId);
  return conversations.map(toConversationListItem);
}

/** Conversaciones de un cliente puntual, más recientes primero — para su historial en la ficha de Cliente. */
export async function listConversationsForClient(
  businessId: string,
  clientId: string,
): Promise<ConversationListItem[]> {
  const conversations = await listConversationsByClient(businessId, clientId);
  return conversations.map(toConversationListItem);
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
  externalMessageId?: string,
) {
  const data = sendMessageInputSchema.parse({ conversationId, content });
  await getConversation(businessId, data.conversationId); // valida pertenencia al negocio

  const message = await createMessageRecord(
    data.conversationId,
    sender,
    data.content,
    externalMessageId,
  );
  if (sender !== "CLIENT") {
    await markConversationAsRead(data.conversationId);
  }
  return message;
}

/**
 * ¿Ya se procesó un mensaje con este id de canal externo? Usado por el
 * Messaging Gateway para detectar reentregas duplicadas de un mismo webhook
 * (Meta puede reintentar la entrega del mismo evento más de una vez) antes
 * de crear el mensaje y correr el Agent de nuevo sobre el mismo texto.
 */
export async function messageExistsForExternalId(externalMessageId: string): Promise<boolean> {
  const existing = await findMessageByExternalId(externalMessageId);
  return existing !== null;
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
