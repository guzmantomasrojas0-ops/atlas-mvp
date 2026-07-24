import { describe, expect, it } from "vitest";
import { defaultClientName, isPhoneBasedChannel } from "@/modules/messaging";

describe("isPhoneBasedChannel", () => {
  it("es cierto para WhatsApp y SMS — su externalUserId es un número de teléfono real", () => {
    expect(isPhoneBasedChannel("WHATSAPP")).toBe(true);
    expect(isPhoneBasedChannel("SMS")).toBe(true);
  });

  it("es falso para Instagram, Messenger y Chat web — su externalUserId es un id opaco de esa plataforma", () => {
    expect(isPhoneBasedChannel("INSTAGRAM")).toBe(false);
    expect(isPhoneBasedChannel("FACEBOOK_MESSENGER")).toBe(false);
    expect(isPhoneBasedChannel("WEB_CHAT")).toBe(false);
  });
});

describe("defaultClientName", () => {
  it("incluye la etiqueta humana del canal y el id externo", () => {
    expect(defaultClientName("WHATSAPP", "+57 300 111 2222")).toBe(
      "Cliente de WhatsApp (+57 300 111 2222)",
    );
  });

  it("distingue el nombre por canal para el mismo externalUserId", () => {
    const whatsapp = defaultClientName("WHATSAPP", "12345");
    const instagram = defaultClientName("INSTAGRAM", "12345");
    expect(whatsapp).not.toBe(instagram);
  });

  it("cubre los cuatro canales del Sprint 15 sin tirar", () => {
    for (const channel of ["WHATSAPP", "WEB_CHAT", "INSTAGRAM", "FACEBOOK_MESSENGER"] as const) {
      expect(() => defaultClientName(channel, "x")).not.toThrow();
    }
  });
});
