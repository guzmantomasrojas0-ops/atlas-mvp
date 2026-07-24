import type { WhatsAppConfig } from "./config";

const GRAPH_API_VERSION = "v20.0";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: { code: string; message: string };
}

const REQUEST_TIMEOUT_MS = 10_000;
// 3 intentos en total (1 original + 2 reintentos) — suficiente para absorber
// un blip transitorio de red o un 429/5xx puntual de Meta sin encadenar tanta
// espera que el cliente de WhatsApp note el delay de la respuesta.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 (rate limit) y 5xx son transitorios — vale la pena reintentar. Cualquier 4xx (token inválido, número fuera de la ventana de reingreso, etc.) no se arregla reintentando. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Llama al endpoint de envío de Meta Cloud API. Nunca tira: cualquier falla
 * (de red, timeout, o un error estructurado que devuelva Meta) se representa
 * como un `WhatsAppSendResult` con `success: false` — así quien llama (el
 * `WhatsAppAdapter`) puede registrar el error sin perder la conversación, que
 * ya quedó persistida en Postgres independientemente de esto. Reintenta con
 * backoff ante fallas transitorias (de red, timeout, 429, 5xx); un error 4xx
 * de Meta (credenciales inválidas, ventana de reingreso expirada, etc.)
 * devuelve `success: false` de inmediato, sin reintentar.
 */
export async function sendWhatsAppTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;
  const body = JSON.stringify({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });

  let lastError: NonNullable<WhatsAppSendResult["error"]>;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      lastError = {
        code: isTimeout ? "TIMEOUT" : "NETWORK_ERROR",
        message: isTimeout
          ? `Se agotó el tiempo de espera (${REQUEST_TIMEOUT_MS}ms) esperando la respuesta de Meta Cloud API.`
          : error instanceof Error
            ? error.message
            : String(error),
      };
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return { success: false, error: lastError };
    } finally {
      clearTimeout(timeoutHandle);
    }

    const responseBody: unknown = await response.json().catch(() => null);
    const metaError = (responseBody as { error?: { code?: unknown; message?: unknown } } | null)
      ?.error;

    if (!response.ok) {
      lastError = {
        code: metaError?.code !== undefined ? String(metaError.code) : String(response.status),
        message:
          typeof metaError?.message === "string"
            ? metaError.message
            : "Error desconocido de Meta Cloud API.",
      };
      if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      return { success: false, error: lastError };
    }

    const messageId = (responseBody as { messages?: { id?: string }[] } | null)?.messages?.[0]?.id;
    return { success: true, messageId };
  }

  // Inalcanzable en la práctica (cada vuelta del loop retorna o sigue a la
  // próxima) — TypeScript necesita un valor de retorno para todos los caminos.
  return { success: false, error: lastError! };
}
