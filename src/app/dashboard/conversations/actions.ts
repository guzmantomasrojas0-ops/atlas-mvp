"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { requireSession } from "@/lib/session";
import { markAsRead, sendMessage } from "@/modules/conversation";

export type SendMessageActionResult = { success: true } | { success: false; error: string };

export async function sendMessageAction(
  conversationId: string,
  content: string,
): Promise<SendMessageActionResult> {
  const { business } = await requireSession();

  try {
    await sendMessage(business.id, conversationId, content);
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: "Escribe un mensaje válido." };
    }
    logger.error({ error }, "sendMessageAction: error inesperado enviando el mensaje.");
    return { success: false, error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/conversations");
  return { success: true };
}

/**
 * Marca una conversación como vista. Best-effort: si falla (por ejemplo la
 * conversación ya no existe), no hay nada útil que mostrarle al usuario —
 * la próxima vez que la abra se vuelve a intentar.
 */
export async function markConversationReadAction(conversationId: string): Promise<void> {
  const { business } = await requireSession();

  try {
    await markAsRead(business.id, conversationId);
  } catch (error) {
    logger.error(
      { error, conversationId },
      "markConversationReadAction: no se pudo marcar como leída.",
    );
    return;
  }

  revalidatePath("/dashboard/conversations");
}
