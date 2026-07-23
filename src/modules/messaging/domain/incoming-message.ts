import type { ConversationChannelValue } from "@/modules/conversation";

/**
 * Un mensaje entrante desde cualquier canal externo, ya traducido al formato
 * interno común. Ningún adapter concreto (WhatsApp, Instagram, etc.) llega
 * más allá de `messaging/` — el Agent solo ve texto plano.
 */
export interface IncomingMessage {
  channel: ConversationChannelValue;
  /** Identificador de la conversación en el sistema externo (ej. el thread id de Instagram). */
  externalConversationId: string;
  /** Identificador del usuario final en el sistema externo (ej. el número de WhatsApp). */
  externalUserId: string;
  text: string;
  timestamp: Date;
}
