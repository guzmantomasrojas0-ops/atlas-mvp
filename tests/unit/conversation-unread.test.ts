import { describe, expect, it } from "vitest";
import { isConversationUnread } from "@/modules/conversation/domain";

describe("isConversationUnread", () => {
  it("es false si no hay ningún mensaje todavía", () => {
    expect(isConversationUnread(null, null)).toBe(false);
  });

  it("es false si el último mensaje lo mandó STAFF", () => {
    const result = isConversationUnread(null, {
      sender: "STAFF",
      createdAt: new Date("2026-07-20T10:00:00Z"),
    });
    expect(result).toBe(false);
  });

  it("es false si el último mensaje lo mandó AGENT", () => {
    const result = isConversationUnread(null, {
      sender: "AGENT",
      createdAt: new Date("2026-07-20T10:00:00Z"),
    });
    expect(result).toBe(false);
  });

  it("es true si el último mensaje es del cliente y nunca se leyó nada", () => {
    const result = isConversationUnread(null, {
      sender: "CLIENT",
      createdAt: new Date("2026-07-20T10:00:00Z"),
    });
    expect(result).toBe(true);
  });

  it("es true si el mensaje del cliente es posterior a la última lectura", () => {
    const result = isConversationUnread(new Date("2026-07-20T09:00:00Z"), {
      sender: "CLIENT",
      createdAt: new Date("2026-07-20T10:00:00Z"),
    });
    expect(result).toBe(true);
  });

  it("es false si ya se leyó después del último mensaje del cliente", () => {
    const result = isConversationUnread(new Date("2026-07-20T11:00:00Z"), {
      sender: "CLIENT",
      createdAt: new Date("2026-07-20T10:00:00Z"),
    });
    expect(result).toBe(false);
  });
});
