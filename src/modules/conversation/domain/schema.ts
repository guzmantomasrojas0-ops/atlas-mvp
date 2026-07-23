import { z } from "zod";

export const CONVERSATION_CHANNELS = [
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK_MESSENGER",
  "SMS",
  "WEB_CHAT",
] as const;

export type ConversationChannelValue = (typeof CONVERSATION_CHANNELS)[number];

export const channelLabels: Record<ConversationChannelValue, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK_MESSENGER: "Facebook Messenger",
  SMS: "SMS",
  WEB_CHAT: "Chat web",
};

/**
 * Quién escribió un mensaje. No es un input de formulario (no lo elige un
 * usuario) — lo determina quién llama a `sendMessage`: hoy siempre STAFF
 * desde el composer; AGENT queda reservado para cuando exista el agente.
 */
export type MessageSenderValue = "CLIENT" | "STAFF" | "AGENT";

export const sendMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1, "Escribí un mensaje").max(4000, "El mensaje es muy largo"),
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
