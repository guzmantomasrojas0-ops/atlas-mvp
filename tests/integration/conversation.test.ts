import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import {
  ConversationNotFoundError,
  findOrCreateConversation,
  getConversation,
  listConversations,
  listMessages,
  markAsRead,
  sendMessage,
} from "@/modules/conversation";

let businessId: string;
let clientId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (conversation)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: "America/Bogota",
    businessType: "BARBERSHOP",
  });
  businessId = business.id;

  const client = await db.client.create({ data: { businessId, name: "Cliente de prueba" } });
  clientId = client.id;
});

afterEach(async () => {
  await db.message.deleteMany({ where: { conversation: { businessId } } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("conversation module — integración con Postgres real", () => {
  it("crea una conversación nueva y reutiliza la misma para el mismo cliente/canal", async () => {
    const first = await findOrCreateConversation(businessId, clientId, "WHATSAPP");
    const second = await findOrCreateConversation(businessId, clientId, "WHATSAPP");
    expect(second.id).toBe(first.id);
  });

  it("crea conversaciones separadas para canales distintos del mismo cliente", async () => {
    const whatsapp = await findOrCreateConversation(businessId, clientId, "WHATSAPP");
    const instagram = await findOrCreateConversation(businessId, clientId, "INSTAGRAM");
    expect(whatsapp.id).not.toBe(instagram.id);
  });

  it("envía un mensaje, lo lista, y marca la conversación como leída", async () => {
    const conversation = await findOrCreateConversation(businessId, clientId, "SMS");
    await sendMessage(businessId, conversation.id, "Hola!");

    const messages = await listMessages(conversation.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ sender: "STAFF", content: "Hola!" });

    const [item] = await listConversations(businessId);
    expect(item.unread).toBe(false);
  });

  it("marca una conversación como no leída cuando el último mensaje es del cliente", async () => {
    const conversation = await findOrCreateConversation(businessId, clientId, "WEB_CHAT");
    await db.message.create({
      data: { conversationId: conversation.id, sender: "CLIENT", content: "Hola, necesito ayuda" },
    });

    const [item] = await listConversations(businessId);
    expect(item.unread).toBe(true);
    expect(item.lastMessagePreview).toBe("Hola, necesito ayuda");
  });

  it("markAsRead hace que una conversación deje de aparecer como no leída", async () => {
    const conversation = await findOrCreateConversation(businessId, clientId, "WEB_CHAT");
    await db.message.create({
      data: { conversationId: conversation.id, sender: "CLIENT", content: "Hola" },
    });

    await markAsRead(businessId, conversation.id);

    const [item] = await listConversations(businessId);
    expect(item.unread).toBe(false);
  });

  it("getConversation tira ConversationNotFoundError para un id que no existe", async () => {
    await expect(getConversation(businessId, "no-existe")).rejects.toThrow(
      ConversationNotFoundError,
    );
  });

  it("getConversation tira ConversationNotFoundError si la conversación es de otro negocio", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 111 2222",
      address: "Otra calle 456",
      timezone: "America/Bogota",
      businessType: "SALON",
    });
    const conversation = await findOrCreateConversation(businessId, clientId, "WHATSAPP");

    await expect(getConversation(otherBusiness.id, conversation.id)).rejects.toThrow(
      ConversationNotFoundError,
    );

    await db.business.delete({ where: { id: otherBusiness.id } });
  });

  it("rechaza enviar un mensaje vacío antes de tocar la base", async () => {
    const conversation = await findOrCreateConversation(businessId, clientId, "WHATSAPP");
    const before = await db.message.count({ where: { conversationId: conversation.id } });

    await expect(sendMessage(businessId, conversation.id, "   ")).rejects.toThrow();

    const after = await db.message.count({ where: { conversationId: conversation.id } });
    expect(after).toBe(before);
  });
});
