import { channelLabels, type ConversationChannelValue } from "@/modules/conversation";

/**
 * Nombre provisional para un Client creado a partir del primer contacto por
 * un canal externo — todavía no sabemos su nombre real, solo su identidad
 * en ese canal (un teléfono, un user id, etc.).
 */
export function defaultClientName(
  channel: ConversationChannelValue,
  externalUserId: string,
): string {
  return `Cliente de ${channelLabels[channel]} (${externalUserId})`;
}
