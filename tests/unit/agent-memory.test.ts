import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore } from "@/modules/agent/domain";

describe("InMemoryMemoryStore", () => {
  it("devuelve memoria vacía para algo que nunca se guardó", () => {
    const store = new InMemoryMemoryStore();

    expect(store.getConversationMemory("conv-1")).toEqual({ conversationId: "conv-1", notes: [] });
    expect(store.getClientMemory("client-1")).toEqual({ clientId: "client-1", notes: [] });
    expect(store.getBusinessMemory("biz-1")).toEqual({ businessId: "biz-1", notes: [] });
  });

  it("acumula notas de conversación sin pisar las anteriores", () => {
    const store = new InMemoryMemoryStore();

    store.addConversationNote("conv-1", "Prefiere turnos a la mañana");
    store.addConversationNote("conv-1", "Ya preguntó por el precio del corte");

    expect(store.getConversationMemory("conv-1").notes).toEqual([
      "Prefiere turnos a la mañana",
      "Ya preguntó por el precio del corte",
    ]);
  });

  it("mantiene los tres alcances completamente separados", () => {
    const store = new InMemoryMemoryStore();

    store.addConversationNote("shared-id", "nota de conversación");
    store.addClientNote("shared-id", "nota de cliente");
    store.addBusinessNote("shared-id", "nota de negocio");

    expect(store.getConversationMemory("shared-id").notes).toEqual(["nota de conversación"]);
    expect(store.getClientMemory("shared-id").notes).toEqual(["nota de cliente"]);
    expect(store.getBusinessMemory("shared-id").notes).toEqual(["nota de negocio"]);
  });

  it("no afecta la memoria de otro id", () => {
    const store = new InMemoryMemoryStore();

    store.addClientNote("client-1", "nota");

    expect(store.getClientMemory("client-2").notes).toEqual([]);
  });
});
