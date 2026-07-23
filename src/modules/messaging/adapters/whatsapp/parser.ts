import { z } from "zod";
import type { IncomingMessage } from "../../domain";

const whatsAppMessageSchema = z
  .object({
    from: z.string(),
    timestamp: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
  })
  .loose();

const whatsAppChangeValueSchema = z
  .object({
    messages: z.array(whatsAppMessageSchema).optional(),
  })
  .loose();

const whatsAppWebhookPayloadSchema = z
  .object({
    entry: z
      .array(
        z
          .object({
            changes: z.array(z.object({ value: whatsAppChangeValueSchema }).loose()).default([]),
          })
          .loose(),
      )
      .default([]),
  })
  .loose();

/**
 * Traduce un payload crudo del webhook de WhatsApp Cloud API a
 * `IncomingMessage[]`. Ignora silenciosamente todo lo que no sea un mensaje
 * de texto (imágenes, audio, documentos, ubicación, botones, listas) y
 * cualquier evento sin `messages` (ej. actualizaciones de estado
 * "delivered"/"read") — un payload así produce una lista vacía, no un error.
 * Un payload que ni siquiera tiene la forma esperada también produce `[]`.
 */
export function parseWhatsAppWebhookPayload(payload: unknown): IncomingMessage[] {
  const result = whatsAppWebhookPayloadSchema.safeParse(payload);
  if (!result.success) return [];

  const messages: IncomingMessage[] = [];
  for (const entry of result.data.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        if (message.type !== "text" || !message.text) continue;

        messages.push({
          channel: "WHATSAPP",
          externalConversationId: message.from,
          externalUserId: message.from,
          text: message.text.body,
          timestamp: new Date(Number(message.timestamp) * 1000),
        });
      }
    }
  }
  return messages;
}
