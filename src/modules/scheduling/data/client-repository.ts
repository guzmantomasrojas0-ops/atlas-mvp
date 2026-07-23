import { db } from "@/lib/db";

/**
 * Busca un cliente existente por nombre (sin distinguir mayúsculas) dentro
 * del negocio, o lo crea. No hay un módulo de gestión de clientes todavía —
 * esta es la única puerta de entrada para crear un `Client`.
 */
export async function findOrCreateClient(businessId: string, name: string, phone?: string) {
  const trimmedName = name.trim();

  const existing = await db.client.findFirst({
    where: { businessId, name: { equals: trimmedName, mode: "insensitive" } },
  });
  if (existing) return existing;

  return db.client.create({
    data: { businessId, name: trimmedName, phone: phone || null },
  });
}
