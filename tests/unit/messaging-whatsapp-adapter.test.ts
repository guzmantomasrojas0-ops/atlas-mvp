import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppAdapter } from "@/modules/messaging";
import type { IncomingMessage } from "@/modules/messaging";

const { loggerErrorMock } = vi.hoisted(() => ({ loggerErrorMock: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const CONFIG = {
  accessToken: "test-token",
  phoneNumberId: "test-phone-id",
  verifyToken: "test-verify-token",
  appSecret: "test-app-secret",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("WhatsAppAdapter — send()", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    loggerErrorMock.mockClear();
  });

  it("envía el texto al endpoint de Meta con el token y el phoneNumberId correctos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new WhatsAppAdapter(CONFIG);
    const result = await adapter.send("573001234567", {
      text: "Hola!",
      attachments: [],
      metadata: {},
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/test-phone-id/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "573001234567",
      type: "text",
      text: { body: "Hola!" },
    });
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("si Meta devuelve un error estructurado, no tira y registra el error (no pierde la conversación)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 131047, message: "Re-engagement window expirada" } }, 400),
        ),
    );

    const adapter = new WhatsAppAdapter(CONFIG);
    const result = await adapter.send("573001234567", {
      text: "Hola!",
      attachments: [],
      metadata: {},
    });

    expect(result).toEqual({ success: false, error: "Re-engagement window expirada" });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalConversationId: "573001234567",
        error: { code: "131047", message: "Re-engagement window expirada" },
      }),
      expect.any(String),
    );
  });

  it("si falla la red, no tira y registra el error igual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")));

    const adapter = new WhatsAppAdapter(CONFIG);
    const result = await adapter.send("573001234567", {
      text: "Hola!",
      attachments: [],
      metadata: {},
    });

    expect(result).toEqual({ success: false, error: "fetch failed" });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: { code: "NETWORK_ERROR", message: "fetch failed" } }),
      expect.any(String),
    );
  });
});

describe("WhatsAppAdapter — handleWebhookPayload()", () => {
  it("tira si todavía no se registró ningún handler", async () => {
    const adapter = new WhatsAppAdapter(CONFIG);
    await expect(adapter.handleWebhookPayload({ entry: [] })).rejects.toThrow();
  });

  it("despacha cada IncomingMessage de texto al handler registrado, en orden, e ignora los que no son texto", async () => {
    const adapter = new WhatsAppAdapter(CONFIG);
    const received: IncomingMessage[] = [];
    adapter.onMessage(async (message) => {
      received.push(message);
    });

    await adapter.handleWebhookPayload({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "1",
                    id: "a",
                    timestamp: "1700000000",
                    type: "text",
                    text: { body: "uno" },
                  },
                  {
                    from: "1",
                    id: "b",
                    timestamp: "1700000001",
                    type: "image",
                    image: { id: "x" },
                  },
                  {
                    from: "1",
                    id: "c",
                    timestamp: "1700000002",
                    type: "text",
                    text: { body: "dos" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(received.map((m) => m.text)).toEqual(["uno", "dos"]);
  });
});
