/**
 * ATLAS distingue tres alcances de memoria — no son intercambiables:
 * - conversación: lo que pasó en este hilo puntual.
 * - cliente: lo que ATLAS sabe de esta persona a través de todas sus conversaciones.
 * - negocio: hechos/reglas propias del negocio, independientes de cualquier cliente.
 *
 * Todavía no hay persistencia compleja — `InMemoryMemoryStore` es una
 * implementación de referencia en memoria, útil para tests y para probar el
 * pipeline. Un futuro store respaldado por la base de datos implementa la
 * misma interfaz `MemoryStore`.
 */
export interface ConversationMemory {
  conversationId: string;
  notes: string[];
}

export interface ClientMemory {
  clientId: string;
  notes: string[];
}

export interface BusinessMemory {
  businessId: string;
  notes: string[];
}

export interface MemoryStore {
  getConversationMemory(conversationId: string): ConversationMemory;
  getClientMemory(clientId: string): ClientMemory;
  getBusinessMemory(businessId: string): BusinessMemory;
  addConversationNote(conversationId: string, note: string): void;
  addClientNote(clientId: string, note: string): void;
  addBusinessNote(businessId: string, note: string): void;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly conversations = new Map<string, ConversationMemory>();
  private readonly clients = new Map<string, ClientMemory>();
  private readonly businesses = new Map<string, BusinessMemory>();

  getConversationMemory(conversationId: string): ConversationMemory {
    return this.conversations.get(conversationId) ?? { conversationId, notes: [] };
  }

  getClientMemory(clientId: string): ClientMemory {
    return this.clients.get(clientId) ?? { clientId, notes: [] };
  }

  getBusinessMemory(businessId: string): BusinessMemory {
    return this.businesses.get(businessId) ?? { businessId, notes: [] };
  }

  addConversationNote(conversationId: string, note: string): void {
    const memory = this.getConversationMemory(conversationId);
    this.conversations.set(conversationId, { ...memory, notes: [...memory.notes, note] });
  }

  addClientNote(clientId: string, note: string): void {
    const memory = this.getClientMemory(clientId);
    this.clients.set(clientId, { ...memory, notes: [...memory.notes, note] });
  }

  addBusinessNote(businessId: string, note: string): void {
    const memory = this.getBusinessMemory(businessId);
    this.businesses.set(businessId, { ...memory, notes: [...memory.notes, note] });
  }
}
