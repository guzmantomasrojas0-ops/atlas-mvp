import type { MessageSenderValue } from "./schema";

export interface LatestMessageInfo {
  sender: MessageSenderValue;
  createdAt: Date;
}

/**
 * ¿Esta conversación tiene un mensaje del cliente sin responder? Si lo
 * último que pasó fue una respuesta de STAFF/AGENT, ya está "leída" por
 * definición — no hace falta comparar fechas. Sin autenticación todavía no
 * hay "leído por usuario": es un solo `lastReadAt` por conversación.
 */
export function isConversationUnread(
  lastReadAt: Date | null,
  latestMessage: LatestMessageInfo | null,
): boolean {
  if (!latestMessage) return false;
  if (latestMessage.sender !== "CLIENT") return false;
  if (!lastReadAt) return true;
  return latestMessage.createdAt > lastReadAt;
}
