import type { IncomingMessage } from "./incoming-message";
import type { OutgoingMessage } from "./outgoing-message";

/**
 * Lo que cualquier canal externo debe poder hacer para entregarle mensajes
 * al Gateway: registrar un handler que se invoca por cada `IncomingMessage`
 * que el canal reciba. Cómo llega ese mensaje (webhook, socket, polling) es
 * responsabilidad exclusiva del adapter — el Gateway nunca lo sabe.
 */
export interface MessageReceiver {
  onMessage(handler: (message: IncomingMessage) => Promise<void>): void;
}

/** Resultado de intentar entregar un mensaje saliente — nunca se tira una excepción por un fallo del canal (de red, o rechazado por el proveedor); se representa acá para que quien llama decida qué hacer (loguear, reintentar). */
export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Lo que cualquier canal externo debe poder hacer para entregar la
 * respuesta del Agent de vuelta al usuario final.
 */
export interface MessageSender {
  send(externalConversationId: string, message: OutgoingMessage): Promise<SendResult>;
}
