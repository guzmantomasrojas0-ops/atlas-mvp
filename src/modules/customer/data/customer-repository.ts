import { db } from "@/lib/db";

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
