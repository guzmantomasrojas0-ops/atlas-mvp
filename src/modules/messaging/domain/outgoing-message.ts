/**
 * Un mensaje saliente del Agent hacia un canal externo. Este sprint es
 * solo-texto: `attachments` queda declarado para cuando exista un canal que
 * los use, pero nada todavía los produce ni los envía.
 */
export interface OutgoingAttachment {
  url: string;
}

export interface OutgoingMessage {
  text: string;
  attachments: OutgoingAttachment[];
  metadata: Record<string, unknown>;
}
