import { db } from "@/lib/db";
import type { CustomerInput } from "../domain";

/**
 * Clientes de un negocio con sus estadísticas: cantidad total de reservas
 * (cualquier estado) y la más reciente que no esté cancelada (para "última
 * visita"). Todo en una sola consulta — nada de N+1 por cliente.
 */
export function listClientsWithStats(businessId: string) {
  return db.client.findMany({
    where: { businessId },
    include: {
      appointments: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
      _count: { select: { appointments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findClientById(businessId: string, id: string) {
  return db.client.findFirst({ where: { id, businessId } });
}

/** Igual que `listClientsWithStats`, pero para un solo cliente — evita traer el negocio entero solo para releer uno. */
export function findClientWithStatsById(businessId: string, id: string) {
  return db.client.findFirst({
    where: { id, businessId },
    include: {
      appointments: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
      _count: { select: { appointments: true } },
    },
  });
}

/** `updateMany` (no `update`) porque scopea por `businessId` en la misma consulta — mismo patrón que `updateStaffMember`. */
export function updateClient(businessId: string, id: string, input: CustomerInput) {
  return db.client.updateMany({
    where: { id, businessId },
    data: { name: input.name, phone: input.phone || null },
  });
}
