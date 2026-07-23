import type { WhatsAppConfig } from "./config";

const GRAPH_API_VERSION = "v20.0";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: { code: string; message: string };
}

/**
 * Llama al endpoint de envío de Meta Cloud API. Nunca tira: cualquier falla
 * (de red, o un error estructurado que devuelva Meta) se representa como un
 * `WhatsAppSendResult` con `success: false` — así quien llama (el
 * `WhatsAppAdapter`) puede registrar el error sin perder la conversación,
 * que ya quedó persistida en Postgres independientemente de esto.
 */
export async function sendWhatsAppTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (error) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const body: unknown = await response.json().catch(() => null);
  const metaError = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;

  if (!response.ok) {
    return {
      success: false,
      error: {
        code: metaError?.code !== undefined ? String(metaError.code) : String(response.status),
        message:
          typeof metaError?.message === "string"
            ? metaError.message
            : "Error desconocido de Meta Cloud API.",
      },
    };
  }

  const messageId = (body as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id;
  return { success: true, messageId };
}
