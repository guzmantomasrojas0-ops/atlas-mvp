import { logger } from "@/lib/logger";
import { type BusinessRef } from "@/modules/agent";
import { getFirstBusiness } from "@/modules/business";
import {
  attachChannel,
  isValidMetaSignature,
  loadWhatsAppConfig,
  MissingWhatsAppCredentialsError,
  WhatsAppAdapter,
  type WhatsAppConfig,
} from "@/modules/messaging";

// node:crypto (validación de firma) y Prisma necesitan el runtime de Node,
// no el Edge Runtime.
export const runtime = "nodejs";

function resolveConfigOrRespond(): WhatsAppConfig | Response {
  try {
    return loadWhatsAppConfig();
  } catch (error) {
    if (error instanceof MissingWhatsAppCredentialsError) {
      logger.error({ error: error.message }, "Webhook de WhatsApp: configuración incompleta.");
      return new Response("WhatsApp no está configurado.", { status: 500 });
    }
    throw error;
  }
}

/** Handshake de verificación de Meta al suscribir el webhook. */
export async function GET(request: Request): Promise<Response> {
  const config = resolveConfigOrRespond();
  if (config instanceof Response) return config;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === config.verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Recepción de eventos reales. Valida la firma de Meta contra el body
 * crudo, ignora cualquier evento que no traiga mensajes de texto (lo
 * resuelve `parseWhatsAppWebhookPayload`), y delega todo lo demás al mismo
 * Messaging Gateway del Sprint 15 — nada de esto conoce al Agent.
 */
export async function POST(request: Request): Promise<Response> {
  const config = resolveConfigOrRespond();
  if (config instanceof Response) return config;

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!isValidMetaSignature(rawBody, signature, config.appSecret)) {
    logger.warn("Webhook de WhatsApp: firma inválida, evento descartado.");
    return new Response("Firma inválida.", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Payload inválido.", { status: 400 });
  }

  // Meta llama acá directamente — no hay sesión de usuario que resolver el
  // negocio a partir de ella (a diferencia de todo lo que vive bajo
  // /dashboard). Hoy WHATSAPP_PHONE_NUMBER_ID es una sola credencial global
  // del proyecto, no una por negocio, así que "el negocio" solo puede
  // resolverse así hasta que exista routing real por número de WhatsApp
  // (deuda técnica conocida — ver el informe final de la Fase 3).
  const business = await getFirstBusiness();
  if (!business) {
    // Todavía no hay ningún negocio configurado — no hay a quién asignarle
    // la conversación. Se reconoce igual para que Meta no reintente.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
  const businessRef: BusinessRef = {
    id: business.id,
    name: business.name,
    timezone: business.timezone,
  };

  try {
    const adapter = new WhatsAppAdapter(config);
    attachChannel(businessRef, adapter, adapter);
    await adapter.handleWebhookPayload(payload);
  } catch (error) {
    // Un fallo procesando el mensaje no debe tirar la conversación entera:
    // se registra y se responde 200 igual (devolver 500 haría que Meta
    // reintente el mismo evento, arriesgando mensajes duplicados en vez de
    // solucionar el problema).
    logger.error({ error }, "Webhook de WhatsApp: error inesperado procesando el evento.");
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
