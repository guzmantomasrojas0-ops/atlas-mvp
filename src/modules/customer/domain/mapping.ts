/** Forma cruda que necesita `toCustomerListItem` — no depende de Prisma, solo de esta forma. */
export interface RawClientWithStats {
  id: string;
  name: string;
  phone: string | null;
  /** Ya filtrado y limitado a 1 por quien llama (ver `data/customer-repository.ts`). */
  appointments: { startsAt: Date }[];
  _count: { appointments: number };
}

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string | null;
  appointmentCount: number;
  lastVisit: Date | null;
}

/**
 * Traduce la forma cruda (Client + agregados) a `CustomerListItem`.
 * `appointmentCount` cuenta todas las reservas históricas (cualquier
 * estado); `lastVisit` en cambio viene ya filtrada para excluir canceladas
 * — una reserva cancelada nunca fue una visita real.
 */
export function toCustomerListItem(client: RawClientWithStats): CustomerListItem {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    appointmentCount: client._count.appointments,
    lastVisit: client.appointments[0]?.startsAt ?? null,
  };
}
