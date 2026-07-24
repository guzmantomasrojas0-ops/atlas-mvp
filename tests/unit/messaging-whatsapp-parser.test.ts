import { describe, expect, it } from "vitest";
import { parseWhatsAppWebhookPayload } from "@/modules/messaging/adapters/whatsapp";

function textMessage(overrides: Record<string, unknown> = {}) {
  return {
    from: "573001234567",
    id: "wamid.TEXT1",
    timestamp: "1700000000",
    type: "text",
    text: { body: "Hola, quiero un corte" },
    ...overrides,
  };
}

function payloadWithMessages(messages: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "test-phone-id" },
              messages,
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

describe("parseWhatsAppWebhookPayload", () => {
  it("traduce un mensaje de texto a un IncomingMessage con channel WHATSAPP", () => {
    const messages = parseWhatsAppWebhookPayload(payloadWithMessages([textMessage()]));

    expect(messages).toEqual([
      {
        channel: "WHATSAPP",
        externalConversationId: "573001234567",
        externalUserId: "573001234567",
        text: "Hola, quiero un corte",
        timestamp: new Date(1700000000 * 1000),
        externalMessageId: "wamid.TEXT1",
      },
    ]);
  });

  it("un mensaje sin id (formato inesperado) deja externalMessageId sin definir, en vez de fallar", () => {
    const messages = parseWhatsAppWebhookPayload(
      payloadWithMessages([textMessage({ id: undefined })]),
    );

    expect(messages[0].externalMessageId).toBeUndefined();
  });

  it("procesa varios mensajes de texto en la misma entrada", () => {
    const messages = parseWhatsAppWebhookPayload(
      payloadWithMessages([
        textMessage({ from: "573001111111", text: { body: "primero" } }),
        textMessage({ from: "573002222222", text: { body: "segundo" } }),
      ]),
    );

    expect(messages.map((m) => m.text)).toEqual(["primero", "segundo"]);
    expect(messages.map((m) => m.externalUserId)).toEqual(["573001111111", "573002222222"]);
  });

  it("ignora mensajes que no son de texto (imagen, audio, documento, ubicación, botones, listas)", () => {
    const unsupported = [
      { from: "1", id: "a", timestamp: "1700000000", type: "image", image: { id: "media-1" } },
      { from: "1", id: "b", timestamp: "1700000000", type: "audio", audio: { id: "media-2" } },
      {
        from: "1",
        id: "c",
        timestamp: "1700000000",
        type: "document",
        document: { id: "media-3" },
      },
      {
        from: "1",
        id: "d",
        timestamp: "1700000000",
        type: "location",
        location: { latitude: 1, longitude: 2 },
      },
      {
        from: "1",
        id: "e",
        timestamp: "1700000000",
        type: "interactive",
        interactive: { type: "button_reply" },
      },
    ];

    expect(parseWhatsAppWebhookPayload(payloadWithMessages(unsupported))).toEqual([]);
  });

  it("ignora un mensaje marcado type: text si no trae el campo text (malformado)", () => {
    const messages = parseWhatsAppWebhookPayload(
      payloadWithMessages([{ from: "1", id: "a", timestamp: "1700000000", type: "text" }]),
    );
    expect(messages).toEqual([]);
  });

  it("un payload de solo actualizaciones de estado (sin messages) no produce nada", () => {
    const statusOnlyPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                statuses: [{ id: "wamid.X", status: "delivered", timestamp: "1700000000" }],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    expect(parseWhatsAppWebhookPayload(statusOnlyPayload)).toEqual([]);
  });

  it("un payload que no tiene la forma esperada produce una lista vacía, no un error", () => {
    expect(parseWhatsAppWebhookPayload(null)).toEqual([]);
    expect(parseWhatsAppWebhookPayload("no soy un objeto")).toEqual([]);
    expect(parseWhatsAppWebhookPayload({})).toEqual([]);
    expect(parseWhatsAppWebhookPayload({ entry: "no es un array" })).toEqual([]);
  });
});
