import { AppError } from "@/lib/errors";

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
}

/** Faltan una o más variables de entorno de WhatsApp Cloud API. */
export class MissingWhatsAppCredentialsError extends AppError {
  readonly code = "MISSING_WHATSAPP_CREDENTIALS";

  constructor(
    message = "Faltan variables de entorno de WhatsApp Cloud API: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET.",
  ) {
    super(message);
  }
}

/**
 * Lee la config real recién cuando hace falta (al validar el webhook o al
 * enviar un mensaje) — nunca al importar este módulo ni al instanciar
 * `WhatsAppAdapter`, igual que `createAnthropicProvider` en el módulo `ai`.
 */
export function loadWhatsAppConfig(): WhatsAppConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!accessToken || !phoneNumberId || !verifyToken || !appSecret) {
    throw new MissingWhatsAppCredentialsError();
  }

  return { accessToken, phoneNumberId, verifyToken, appSecret };
}
