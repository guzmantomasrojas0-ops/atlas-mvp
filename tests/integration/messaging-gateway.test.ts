import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AIService } from "@/modules/ai";
import type { CompletionResponse, LanguageModel } from "@/modules/ai";
import type { BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { listMessages } from "@/modules/conversation";
import { attachChannel, ConsoleAdapter } from "@/modules/messaging";
import type { IncomingMessage } from "@/modules/messaging";

const TIMEZONE = "America/Bogota";

function textResponse(content: string): CompletionResponse {
  return {
    message: { role: "assistant", content },
    toolCalls: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: "stop",
  };
}

function singleTurnModel(content: string): LanguageModel {
  return {
    name: "anthropic",
    async complete(): Promise<CompletionResponse> {
      return textResponse(content);
    },
  };
}

function incoming(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    channel: "WEB_CHAT",
    externalConversationId: "web-session-1",
    externalUserId: "web-session-1",
    text: "Hola",
    timestamp: new Date(),
    ...overrides,
  };
}

async function cleanupBusiness(id: string): Promise<void> {
  await db.channelMapping.deleteMany({ where: { businessId: id } });
  await db.message.deleteMany({ where: { conversation: { businessId: id } } });
  await db.conversation.deleteMany({ where: { businessId: id } });
  await db.client.deleteMany({ where: { businessId: id } });
  await db.business.delete({ where: { id } });
}

let business: BusinessRef;
let businessId: string;

beforeEach(async () => {
  const created = await createBusiness({
    name: "Barbería Sprint 15",
    phone: "+57 300 000 0001",
    address: "Calle Falsa 456",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  business = { id: created.id, name: created.name, timezone: created.timezone };
  businessId = created.id;
});

afterEach(async () => {
  await cleanupBusiness(businessId);
});

describe("Messaging Gateway — ConsoleAdapter -> Conversation -> Agent -> OutgoingMessage", () => {
  it("primer contacto: crea Client + Conversation + ChannelMapping, persiste el mensaje, y entrega la respuesta del Agent", async () => {
    const adapter = new ConsoleAdapter();
    attachChannel(
      business,
      adapter,
      adapter,
      new AIService(singleTurnModel("¡Hola! ¿En qué te ayudo?")),
    );

    await adapter.simulateIncoming(incoming({ text: "Hola, quiero un corte" }));

    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]).toMatchObject({
      externalConversationId: "web-session-1",
      message: { text: "¡Hola! ¿En qué te ayudo?", attachments: [], metadata: {} },
    });

    const mapping = await db.channelMapping.findUnique({
      where: {
        businessId_channel_externalConversationId: {
          businessId,
          channel: "WEB_CHAT",
          externalConversationId: "web-session-1",
        },
      },
    });
    expect(mapping).not.toBeNull();

    const conversation = await db.conversation.findUnique({
      where: { id: mapping!.conversationId },
    });
    expect(conversation?.businessId).toBe(businessId);
    expect(conversation?.channel).toBe("WEB_CHAT");

    const messages = await listMessages(mapping!.conversationId);
    expect(messages.map((m) => `${m.sender}: ${m.content}`)).toEqual([
      "CLIENT: Hola, quiero un corte",
      "AGENT: ¡Hola! ¿En qué te ayudo?",
    ]);

    expect(await db.client.count({ where: { businessId } })).toBe(1);
    expect(await db.conversation.count({ where: { businessId } })).toBe(1);
  });

  it("un segundo mensaje con el mismo externalConversationId reutiliza la misma Conversation, sin duplicar Client/Conversation/mapping", async () => {
    const adapter = new ConsoleAdapter();
    attachChannel(business, adapter, adapter, new AIService(singleTurnModel("respuesta")));

    await adapter.simulateIncoming(incoming({ text: "primer mensaje" }));
    await adapter.simulateIncoming(incoming({ text: "segundo mensaje" }));

    expect(await db.client.count({ where: { businessId } })).toBe(1);
    expect(await db.conversation.count({ where: { businessId } })).toBe(1);
    expect(await db.channelMapping.count({ where: { businessId } })).toBe(1);

    const conversation = await db.conversation.findFirst({ where: { businessId } });
    const messages = await listMessages(conversation!.id);
    expect(messages.map((m) => m.content)).toEqual([
      "primer mensaje",
      "respuesta",
      "segundo mensaje",
      "respuesta",
    ]);
  });

  it("negocios distintos con el mismo externalConversationId no colisionan", async () => {
    const other = await createBusiness({
      name: "Otra barbería",
      phone: "+57 300 000 0002",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });
    const otherRef: BusinessRef = { id: other.id, name: other.name, timezone: other.timezone };

    try {
      const adapterA = new ConsoleAdapter();
      const adapterB = new ConsoleAdapter();
      attachChannel(business, adapterA, adapterA, new AIService(singleTurnModel("de negocio A")));
      attachChannel(otherRef, adapterB, adapterB, new AIService(singleTurnModel("de negocio B")));

      await adapterA.simulateIncoming(incoming({ externalConversationId: "same-id" }));
      await adapterB.simulateIncoming(incoming({ externalConversationId: "same-id" }));

      expect(adapterA.sent[0].message.text).toBe("de negocio A");
      expect(adapterB.sent[0].message.text).toBe("de negocio B");
      expect(await db.conversation.count({ where: { businessId } })).toBe(1);
      expect(await db.conversation.count({ where: { businessId: other.id } })).toBe(1);
    } finally {
      await cleanupBusiness(other.id);
    }
  });

  it("múltiples usuarios distintos hablando al mismo tiempo conservan, cada uno, su propio contexto", async () => {
    const adapter = new ConsoleAdapter();
    attachChannel(
      business,
      adapter,
      adapter,
      // Responde en función del propio mensaje recibido, no de un contador
      // compartido — así ninguna respuesta depende del orden de llegada
      // entre las llamadas concurrentes.
      new AIService({
        name: "anthropic",
        async complete(request) {
          const lastUserMessage = [...request.messages].reverse().find((m) => m.role === "user");
          return textResponse(`recibido: ${lastUserMessage?.content}`);
        },
      }),
    );

    const users = ["ana", "beto", "caro"];
    await Promise.all(
      users.map((user) =>
        adapter.simulateIncoming(
          incoming({
            externalConversationId: `conv-${user}`,
            externalUserId: `user-${user}`,
            text: `Hola soy ${user}`,
          }),
        ),
      ),
    );

    expect(await db.client.count({ where: { businessId } })).toBe(3);
    expect(await db.conversation.count({ where: { businessId } })).toBe(3);

    for (const user of users) {
      const sent = adapter.sent.find((s) => s.externalConversationId === `conv-${user}`);
      expect(sent?.message.text).toBe(`recibido: Hola soy ${user}`);

      const mapping = await db.channelMapping.findUnique({
        where: {
          businessId_channel_externalConversationId: {
            businessId,
            channel: "WEB_CHAT",
            externalConversationId: `conv-${user}`,
          },
        },
      });
      const messages = await listMessages(mapping!.conversationId);
      expect(messages.map((m) => `${m.sender}: ${m.content}`)).toEqual([
        `CLIENT: Hola soy ${user}`,
        `AGENT: recibido: Hola soy ${user}`,
      ]);
    }
  });
});
