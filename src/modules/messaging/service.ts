import { logger } from "@/lib/logger";
import type { AIService } from "@/modules/ai";
import { converseWithAgent, type BusinessRef } from "@/modules/agent";
import { messageExistsForExternalId, sendMessage } from "@/modules/conversation";
import { findOrCreateMappedConversation } from "./data";
import type { IncomingMessage, MessageReceiver, MessageSender, OutgoingMessage } from "./domain";

/**
 * El Message Gateway: traduce un `IncomingMessage` de cualquier canal en una
 * respuesta del mismo Agent conversacional del Sprint 12/13/14 — sin ningún
 * pipeline nuevo. `aiService` es opcional y solo existe para que los tests
 * puedan pasar un modelo con guión, igual que ya hace `converseWithAgent`.
 */
export async function receiveMessage(
  business: BusinessRef,
  incoming: IncomingMessage,
  aiService?: AIService,
): Promise<OutgoingMessage | null> {
  // Meta (y en general cualquier proveedor de webhooks) garantiza entrega
  // "al menos una vez", no "exactamente una vez" — puede reintentar el mismo
  // evento si nuestra respuesta se demoró o se perdió en tránsito. Sin este
  // chequeo, una reentrega duplicada crearía un segundo mensaje CLIENT y
  // volvería a correr el Agent sobre el mismo texto (doble respuesta, o peor,
  // una reserva duplicada si el texto era una confirmación).
  if (incoming.externalMessageId) {
    const alreadyProcessed = await messageExistsForExternalId(incoming.externalMessageId);
    if (alreadyProcessed) {
      logger.info(
        { businessId: business.id, externalMessageId: incoming.externalMessageId },
        "Mensaje entrante duplicado (reentrega del mismo evento) — ignorado.",
      );
      return null;
    }
  }

  const conversationId = await findOrCreateMappedConversation(
    business.id,
    incoming.channel,
    incoming.externalConversationId,
    incoming.externalUserId,
  );

  await sendMessage(
    business.id,
    conversationId,
    incoming.text,
    "CLIENT",
    incoming.externalMessageId,
  );
  const result = await converseWithAgent(business, conversationId, incoming.text, aiService);

  if (!result.response) return null;
  return { text: result.response, attachments: [], metadata: {} };
}

/**
 * Conecta un canal concreto (su `MessageReceiver` y `MessageSender`) al
 * Gateway: cada `IncomingMessage` que el receiver reporte se procesa y, si
 * produce una respuesta, se entrega de vuelta a través del sender.
 */
export function attachChannel(
  business: BusinessRef,
  receiver: MessageReceiver,
  sender: MessageSender,
  aiService?: AIService,
): void {
  receiver.onMessage(async (incoming) => {
    const outgoing = await receiveMessage(business, incoming, aiService);
    if (outgoing) {
      await sender.send(incoming.externalConversationId, outgoing);
    }
  });
}
