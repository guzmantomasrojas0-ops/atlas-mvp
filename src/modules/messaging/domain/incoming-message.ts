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
  /**
   * El id que el canal externo le puso a este mensaje puntual (ej. el
   * `wamid.` de WhatsApp). Opcional porque no todos los canales lo
   * proveen — cuando existe, el Gateway lo usa para detectar reentregas
   * duplicadas del mismo evento (Meta puede reintentar la entrega de un
   * webhook más de una vez).
   */
  externalMessageId?: string;
}
