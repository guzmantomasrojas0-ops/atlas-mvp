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

const PHONE_BASED_CHANNELS: ReadonlySet<ConversationChannelValue> = new Set(["WHATSAPP", "SMS"]);

/**
 * ¿El `externalUserId` de este canal ES un número de teléfono? Cierto para
 * WhatsApp/SMS (Meta manda el número real en `from`); falso para
 * Instagram/Messenger (un id de usuario opaco de esa plataforma) y Chat web
 * (un id de sesión). Se usa para decidir si vale la pena guardar
 * `externalUserId` como `Client.phone` al crear el contacto — sin esto, el
 * teléfono real de un cliente que escribe por WhatsApp quedaba solo
 * incrustado en su nombre provisional, nunca en un campo usable, y
 * `notifications/` (que exige `client.phone` para poder enviar un
 * recordatorio) saltaba silenciosamente cada recordatorio de ese cliente.
 */
export function isPhoneBasedChannel(channel: ConversationChannelValue): boolean {
  return PHONE_BASED_CHANNELS.has(channel);
}
