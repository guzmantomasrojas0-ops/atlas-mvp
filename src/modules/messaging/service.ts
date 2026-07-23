import type { AIService } from "@/modules/ai";
import { converseWithAgent, type BusinessRef } from "@/modules/agent";
import { sendMessage } from "@/modules/conversation";
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
  const conversationId = await findOrCreateMappedConversation(
    business.id,
    incoming.channel,
    incoming.externalConversationId,
    incoming.externalUserId,
  );

  await sendMessage(business.id, conversationId, incoming.text, "CLIENT");
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
