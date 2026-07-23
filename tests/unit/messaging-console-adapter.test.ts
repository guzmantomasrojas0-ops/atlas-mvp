import { describe, expect, it } from "vitest";
import { ConsoleAdapter } from "@/modules/messaging";
import type { IncomingMessage } from "@/modules/messaging";

function message(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    channel: "WEB_CHAT",
    externalConversationId: "conv-ext-1",
    externalUserId: "user-ext-1",
    text: "Hola",
    timestamp: new Date(),
    ...overrides,
  };
}

describe("ConsoleAdapter", () => {
  it("tira si se simula un mensaje entrante antes de registrar un handler", async () => {
    const adapter = new ConsoleAdapter();
    await expect(adapter.simulateIncoming(message())).rejects.toThrow(/handler/i);
  });

  it("invoca el handler registrado con exactamente el mensaje simulado", async () => {
    const adapter = new ConsoleAdapter();
    const received: IncomingMessage[] = [];
    adapter.onMessage(async (incoming) => {
      received.push(incoming);
    });

    const msg = message({ text: "Quiero un corte" });
    await adapter.simulateIncoming(msg);

    expect(received).toEqual([msg]);
  });

  it("un handler nuevo reemplaza al anterior, no se acumulan", async () => {
    const adapter = new ConsoleAdapter();
    let firstCalls = 0;
    let secondCalls = 0;
    adapter.onMessage(async () => {
      firstCalls += 1;
    });
    adapter.onMessage(async () => {
      secondCalls += 1;
    });

    await adapter.simulateIncoming(message());

    expect(firstCalls).toBe(0);
    expect(secondCalls).toBe(1);
  });

  it("send() guarda cada mensaje saliente en sent, en orden, y confirma éxito", async () => {
    const adapter = new ConsoleAdapter();
    const resultA = await adapter.send("conv-a", { text: "Hola A", attachments: [], metadata: {} });
    const resultB = await adapter.send("conv-b", { text: "Hola B", attachments: [], metadata: {} });

    expect(resultA).toEqual({ success: true });
    expect(resultB).toEqual({ success: true });
    expect(adapter.sent).toEqual([
      {
        externalConversationId: "conv-a",
        message: { text: "Hola A", attachments: [], metadata: {} },
      },
      {
        externalConversationId: "conv-b",
        message: { text: "Hola B", attachments: [], metadata: {} },
      },
    ]);
  });
});
