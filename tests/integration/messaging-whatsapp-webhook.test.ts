import { createHmac } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { listMessages } from "@/modules/conversation";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";

const TIMEZONE = "America/Bogota";

/**
 * El webhook resuelve el negocio con `getFirstBusiness()` (el más viejo por
 * `createdAt`) — igual que el resto del dashboard, ver `context-source.ts`.
 * La base de dev compartida trae de entrada el negocio sembrado por
 * `prisma/seed.ts`, más viejo que cualquiera creado acá — sin borrarlo antes,
 * el webhook le asignaría la conversación al negocio de ejemplo, no al de
 * este test. Se restaura con `npx prisma db seed` al final de la
 * verificación completa, igual que ya exige el resto de la suite.
 */
async function deleteBusinessCompletely(id: string): Promise<void> {
  await db.session.deleteMany({ where: { user: { businessId: id } } });
  await db.user.deleteMany({ where: { businessId: id } });
  await db.channelMapping.deleteMany({ where: { businessId: id } });
  await db.message.deleteMany({ where: { conversation: { businessId: id } } });
  await db.conversation.deleteMany({ where: { businessId: id } });
  await db.payment.deleteMany({ where: { businessId: id } });
  await db.appointment.deleteMany({ where: { businessId: id } });
  await db.client.deleteMany({ where: { businessId: id } });
  await db.service.deleteMany({ where: { businessId: id } });
  await db.staffMember.deleteMany({ where: { businessId: id } });
  await db.business.delete({ where: { id } });
}

beforeAll(async () => {
  const preexisting = await db.business.findMany({ select: { id: true } });
  for (const { id } of preexisting) {
    await deleteBusinessCompletely(id);
  }
});

const ENV = {
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "test-phone-id",
  WHATSAPP_VERIFY_TOKEN: "test-verify-token",
  WHATSAPP_APP_SECRET: "test-app-secret",
} as const;

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", ENV.WHATSAPP_APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

function webhookPayload(from: string, text: string, timestampSeconds = 1700000000) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: ENV.WHATSAPP_PHONE_NUMBER_ID },
              messages: [
                {
                  from,
                  id: `wamid.${from}.${timestampSeconds}`,
                  timestamp: String(timestampSeconds),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

function statusOnlyPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              statuses: [{ id: "wamid.STATUS", status: "delivered", timestamp: "1700000000" }],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

function postRequest(body: unknown, { signed = true } = {}): Request {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) headers["x-hub-signature-256"] = sign(rawBody);
  return new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

let originalEnv: Partial<Record<keyof typeof ENV, string | undefined>>;
let businessId: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  originalEnv = {};
  for (const key of Object.keys(ENV) as (keyof typeof ENV)[]) {
    originalEnv[key] = process.env[key];
    process.env[key] = ENV[key];
  }

  const business = await createBusiness({
    name: "Barbería Sprint 16",
    phone: "+57 300 000 0099",
    address: "Calle Falsa 789",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;

  // Meta completamente mockeada — este test no toca la red real.
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.channelMapping.deleteMany({ where: { businessId } });
  await db.message.deleteMany({ where: { conversation: { businessId } } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });

  for (const key of Object.keys(ENV) as (keyof typeof ENV)[]) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("GET /api/webhooks/whatsapp — handshake de verificación de Meta", () => {
  it("devuelve el challenge tal cual si el verify_token coincide", async () => {
    const url =
      "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345";
    const response = await GET(new Request(url));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("responde 403 si el verify_token no coincide", async () => {
    const url =
      "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=incorrecto&hub.challenge=12345";
    const response = await GET(new Request(url));

    expect(response.status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp — Meta → WhatsAppAdapter → Messaging Gateway → Conversation → Agent → respuesta", () => {
  it("rechaza con 401 un webhook con firma inválida, sin crear nada en la base", async () => {
    const response = await POST(
      postRequest(webhookPayload("573001234567", "Hola"), { signed: false }),
    );

    expect(response.status).toBe(401);
    expect(await db.conversation.count({ where: { businessId } })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("primer mensaje de un número nuevo: crea Client + Conversation + ChannelMapping, corre el Agent, y entrega la respuesta por WhatsApp", async () => {
    const response = await POST(
      postRequest(webhookPayload("573001234567", "Hola, quiero un corte")),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("EVENT_RECEIVED");

    const mapping = await db.channelMapping.findUnique({
      where: {
        businessId_channel_externalConversationId: {
          businessId,
          channel: "WHATSAPP",
          externalConversationId: "573001234567",
        },
      },
    });
    expect(mapping).not.toBeNull();
    expect(mapping?.externalUserId).toBe("573001234567");

    const expectedReply = '[respuesta simulada de openai] recibido: "Hola, quiero un corte"';
    const messages = await listMessages(mapping!.conversationId);
    expect(messages.map((m) => `${m.sender}: ${m.content}`)).toEqual([
      "CLIENT: Hola, quiero un corte",
      `AGENT: ${expectedReply}`,
    ]);

    expect(await db.client.count({ where: { businessId } })).toBe(1);
    expect(await db.conversation.count({ where: { businessId } })).toBe(1);

    // El teléfono real del cliente (el mismo número que Meta mandó en
    // `from`) queda guardado en Client.phone, no solo incrustado en su
    // nombre provisional — sin esto, sus recordatorios automáticos (que
    // exigen `client.phone`) nunca se enviarían.
    const client = await db.client.findFirst({ where: { businessId } });
    expect(client?.phone).toBe("573001234567");

    // La respuesta del Agent se entregó de vuelta al cliente por WhatsApp Cloud API (mockeada).
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/test-phone-id/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "573001234567",
      type: "text",
      text: { body: expectedReply },
    });
  });

  it("un segundo mensaje del mismo número reutiliza la misma Conversation, sin duplicar Client/mapping", async () => {
    await POST(postRequest(webhookPayload("573009999999", "primer mensaje", 1700000000)));
    await POST(postRequest(webhookPayload("573009999999", "segundo mensaje", 1700000060)));

    expect(await db.client.count({ where: { businessId } })).toBe(1);
    expect(await db.conversation.count({ where: { businessId } })).toBe(1);
    expect(await db.channelMapping.count({ where: { businessId } })).toBe(1);
  });

  it("ignora eventos sin mensajes de texto (ej. actualizaciones de estado 'delivered') sin crear nada", async () => {
    const response = await POST(postRequest(statusOnlyPayload()));

    expect(response.status).toBe(200);
    expect(await db.conversation.count({ where: { businessId } })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una reentrega del mismo webhook (mismo wamid) se ignora — Meta puede reintentar la misma entrega", async () => {
    const payload = webhookPayload("573005555555", "Hola, quiero un corte");

    const first = await POST(postRequest(payload));
    const second = await POST(postRequest(payload)); // Meta reintenta el mismo evento.

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await db.conversation.count({ where: { businessId } })).toBe(1);
    expect(await db.client.count({ where: { businessId } })).toBe(1);

    const conversation = await db.conversation.findFirst({ where: { businessId } });
    const messages = await listMessages(conversation!.id);
    expect(messages).toHaveLength(2); // CLIENT + AGENT, no duplicados.

    // La respuesta del Agent se entregó una sola vez, no dos.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
