import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWhatsAppTextMessage } from "@/modules/messaging/adapters/whatsapp/client";

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

describe("sendWhatsAppTextMessage — reintentos y timeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("éxito en el primer intento no reintenta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({ success: true, messageId: "wamid.OUT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta ante un 500 transitorio y termina con éxito", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "server error" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({ success: true, messageId: "wamid.OUT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta ante un 429 (rate limit) de Meta", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "rate limited" } }, 429))
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({ success: true, messageId: "wamid.OUT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta ante una falla de red y termina con éxito", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({ success: true, messageId: "wamid.OUT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta ante un 4xx (no transitorio) — falla de inmediato", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: 131047, message: "Re-engagement window expirada" } }, 400),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({
      success: false,
      error: { code: "131047", message: "Re-engagement window expirada" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("agota los reintentos y devuelve el último error si todos los intentos fallan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: "server error" } }, 503));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un abort (timeout) se clasifica como TIMEOUT, no como NETWORK_ERROR, y reintenta", async () => {
    function abortError(): Error {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      return error;
    }

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: "wamid.OUT" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result).toEqual({ success: true, messageId: "wamid.OUT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("si se agotan los reintentos tras solo timeouts, el error final es TIMEOUT", async () => {
    function abortError(): Error {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      return error;
    }

    const fetchMock = vi.fn().mockRejectedValue(abortError());
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTextMessage(CONFIG, "573001234567", "Hola!");

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("TIMEOUT");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
