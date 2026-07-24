import { logger } from "@/lib/logger";
import type {
  IncomingMessage,
  MessageReceiver,
  MessageSender,
  OutgoingMessage,
  SendResult,
} from "../../domain";
import { loadWhatsAppConfig, type WhatsAppConfig } from "./config";
import { sendWhatsAppTextMessage } from "./client";
import { parseWhatsAppWebhookPayload } from "./parser";

/**
 * El adapter concreto de WhatsApp Cloud API — la única pieza de todo el
 * proyecto que sabe que WhatsApp existe. El Agent, el Conversation Loop y
 * el Messaging Gateway no importan nada de este archivo directamente; solo
 * ven `MessageReceiver`/`MessageSender`.
 */
export class WhatsAppAdapter implements MessageReceiver, MessageSender {
  private handler: ((message: IncomingMessage) => Promise<void>) | null = null;

  /**
   * `config` es opcional a propósito: en producción se resuelve recién al
   * primer uso real (vía `loadWhatsAppConfig()`), nunca al construir el
   * adapter — así instanciarlo sin las variables de entorno configuradas
   * todavía no rompe nada. Los tests pasan una config falsa directamente.
   */
  constructor(private readonly config: WhatsAppConfig | null = null) {}

  private resolveConfig(): WhatsAppConfig {
    return this.config ?? loadWhatsAppConfig();
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
  }

  /**
   * Punto de entrada del webhook: traduce el payload crudo de Meta y
   * despacha cada `IncomingMessage` resultante al handler que el Gateway
   * registró vía `attachChannel`. Un payload sin mensajes de texto (solo
   * updates de estado, u otros tipos de contenido) no despacha nada.
   */
  async handleWebhookPayload(payload: unknown): Promise<void> {
    if (!this.handler) {
      throw new Error(
        "WhatsAppAdapter no tiene ningún handler registrado — llama a attachChannel() primero.",
      );
    }
    for (const message of parseWhatsAppWebhookPayload(payload)) {
      await this.handler(message);
    }
  }

  async send(externalConversationId: string, message: OutgoingMessage): Promise<SendResult> {
    const result = await sendWhatsAppTextMessage(
      this.resolveConfig(),
      externalConversationId,
      message.text,
    );
    if (!result.success) {
      logger.error(
        { externalConversationId, error: result.error },
        "No se pudo entregar el mensaje al cliente por WhatsApp Cloud API.",
      );
      return { success: false, error: result.error?.message ?? "Error desconocido." };
    }
    return { success: true };
  }
}
