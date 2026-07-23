import { describe, expect, it } from "vitest";
import { sendMessageInputSchema } from "@/modules/conversation/domain";

describe("sendMessageInputSchema", () => {
  it("acepta un mensaje válido", () => {
    const result = sendMessageInputSchema.safeParse({
      conversationId: "conv_1",
      content: "Hola, ¿cómo estás?",
    });
    expect(result.success).toBe(true);
  });

  it("recorta espacios en blanco del contenido", () => {
    const result = sendMessageInputSchema.safeParse({
      conversationId: "conv_1",
      content: "  Hola  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("Hola");
    }
  });

  it("rechaza un mensaje vacío", () => {
    expect(
      sendMessageInputSchema.safeParse({ conversationId: "conv_1", content: "" }).success,
    ).toBe(false);
  });

  it("rechaza un mensaje que es solo espacios en blanco", () => {
    expect(
      sendMessageInputSchema.safeParse({ conversationId: "conv_1", content: "   " }).success,
    ).toBe(false);
  });

  it("rechaza un mensaje demasiado largo", () => {
    const result = sendMessageInputSchema.safeParse({
      conversationId: "conv_1",
      content: "a".repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza si falta el conversationId", () => {
    expect(sendMessageInputSchema.safeParse({ conversationId: "", content: "Hola" }).success).toBe(
      false,
    );
  });
});
