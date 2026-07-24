import type {
  IncomingMessage,
  MessageReceiver,
  MessageSender,
  OutgoingMessage,
  SendResult,
} from "../domain";

export interface ConsoleSentMessage {
  externalConversationId: string;
  message: OutgoingMessage;
}

/**
 * Adapter de prueba: no habla con ningún canal real. `simulateIncoming` deja
 * que un test inyecte un `IncomingMessage` como si hubiera llegado por un
 * canal de verdad; `send` no imprime nada por consola, solo lo guarda en
 * `sent` para que el test lo pueda inspeccionar.
 */
export class ConsoleAdapter implements MessageReceiver, MessageSender {
  private handler: ((message: IncomingMessage) => Promise<void>) | null = null;
  readonly sent: ConsoleSentMessage[] = [];

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
  }

  async simulateIncoming(message: IncomingMessage): Promise<void> {
    if (!this.handler) {
      throw new Error(
        "ConsoleAdapter no tiene ningún handler registrado — llama a attachChannel() primero.",
      );
    }
    await this.handler(message);
  }

  async send(externalConversationId: string, message: OutgoingMessage): Promise<SendResult> {
    this.sent.push({ externalConversationId, message });
    return { success: true };
  }
}
