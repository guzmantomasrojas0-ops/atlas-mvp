import { db } from "@/lib/db";
import type { PeakHour, RevenuePoint, ServiceSales } from "../domain";

/**
 * Todas las consultas de este módulo son de solo lectura y de agregación
 * (count/sum/group by) sobre las tablas compartidas, siempre acotadas por
 * `businessId`. No duplican la lógica de listado de otros módulos: acá nunca
 * se traen filas completas para contarlas en JS — se agrega en Postgres.
 * Las métricas que dependen de la hora LOCAL del negocio (ingresos por día,
 * horas pico) usan `AT TIME ZONE` con el timezone del negocio; el resto usa
 * agregados de Prisma.
 */

/** Ingresos confirmados (Payment.status = CONFIRMED) en el período. */
export async function sumConfirmedRevenue(
  businessId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await db.payment.aggregate({
    where: { businessId, status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return result._sum.amount?.toNumber() ?? 0;
}

/** Ingresos confirmados agrupados por día local del negocio. */
export async function revenueByLocalDay(
  businessId: string,
  timezone: string,
  start: Date,
  end: Date,
): Promise<RevenuePoint[]> {
  const rows = await db.$queryRaw<{ date: string; amount: number }[]>`
    SELECT to_char(date_trunc('day', "confirmedAt" AT TIME ZONE ${timezone}), 'YYYY-MM-DD') AS date,
           SUM("amount")::float8 AS amount
    FROM "payments"
    WHERE "businessId" = ${businessId}
      AND "status" = 'CONFIRMED'
      AND "confirmedAt" >= ${start}
      AND "confirmedAt" < ${end}
    GROUP BY 1
    ORDER BY 1 ASC`;
  return rows.map((r) => ({ date: r.date, amount: Number(r.amount) }));
}

/** Reservas creadas en el período, contadas por estado. */
export async function countBookingsByStatus(
  businessId: string,
  start: Date,
  end: Date,
): Promise<{ confirmed: number; cancelled: number }> {
  const grouped = await db.appointment.groupBy({
    by: ["status"],
    where: { businessId, createdAt: { gte: start, lt: end } },
    _count: { _all: true },
  });
  let confirmed = 0;
  let cancelled = 0;
  for (const g of grouped) {
    if (g.status === "CONFIRMED") confirmed = g._count._all;
    if (g.status === "CANCELLED") cancelled = g._count._all;
  }
  return { confirmed, cancelled };
}

/** Clientes nuevos (creados) en el período. */
export function countNewClients(businessId: string, start: Date, end: Date): Promise<number> {
  return db.client.count({ where: { businessId, createdAt: { gte: start, lt: end } } });
}

/** Servicios más vendidos en el período: reservas no canceladas + ingreso confirmado asociado. */
export async function topServicesInRange(
  businessId: string,
  start: Date,
  end: Date,
  limit: number,
): Promise<ServiceSales[]> {
  const rows = await db.$queryRaw<
    { serviceId: string; serviceName: string; bookings: bigint; revenue: number }[]
  >`
    SELECT s."id" AS "serviceId",
           s."name" AS "serviceName",
           COUNT(a."id") AS bookings,
           COALESCE(SUM(p."amount") FILTER (WHERE p."status" = 'CONFIRMED'), 0)::float8 AS revenue
    FROM "appointments" a
    JOIN "services" s ON s."id" = a."serviceId"
    LEFT JOIN "payments" p ON p."appointmentId" = a."id"
    WHERE a."businessId" = ${businessId}
      AND a."status" <> 'CANCELLED'
      AND a."createdAt" >= ${start}
      AND a."createdAt" < ${end}
    GROUP BY s."id", s."name"
    ORDER BY bookings DESC, revenue DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    bookings: Number(r.bookings),
    revenue: Number(r.revenue),
  }));
}

/** Distribución de reservas por hora local de inicio, en el período (solo horas con al menos una). */
export async function peakHoursInRange(
  businessId: string,
  timezone: string,
  start: Date,
  end: Date,
): Promise<PeakHour[]> {
  const rows = await db.$queryRaw<{ hour: number; bookings: bigint }[]>`
    SELECT EXTRACT(HOUR FROM "startsAt" AT TIME ZONE ${timezone})::int AS hour,
           COUNT(*) AS bookings
    FROM "appointments"
    WHERE "businessId" = ${businessId}
      AND "status" <> 'CANCELLED'
      AND "startsAt" >= ${start}
      AND "startsAt" < ${end}
    GROUP BY 1
    ORDER BY 1 ASC`;
  return rows.map((r) => ({ hour: Number(r.hour), bookings: Number(r.bookings) }));
}

/**
 * Conversión WhatsApp → Reserva en el período: de las conversaciones de
 * WhatsApp abiertas en el período, cuántas pertenecen a un cliente que hizo
 * al menos una reserva (en cualquier momento). Una sola consulta.
 */
export async function whatsappConversion(
  businessId: string,
  start: Date,
  end: Date,
): Promise<{ conversations: number; converted: number }> {
  const rows = await db.$queryRaw<{ conversations: bigint; converted: bigint }[]>`
    SELECT COUNT(*) AS conversations,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "appointments" a WHERE a."clientId" = c."clientId"
           )) AS converted
    FROM "conversations" c
    WHERE c."businessId" = ${businessId}
      AND c."channel" = 'WHATSAPP'
      AND c."createdAt" >= ${start}
      AND c."createdAt" < ${end}`;
  const row = rows[0];
  return {
    conversations: row ? Number(row.conversations) : 0,
    converted: row ? Number(row.converted) : 0,
  };
}

/** Snapshot actual de cobros: cuántas citas confirmadas están pagas vs. pendientes (no acotado al período). */
export async function countPaymentStatus(
  businessId: string,
): Promise<{ pending: number; confirmed: number }> {
  const grouped = await db.appointment.groupBy({
    by: ["paymentStatus"],
    where: { businessId, status: "CONFIRMED" },
    _count: { _all: true },
  });
  let pending = 0;
  let confirmed = 0;
  for (const g of grouped) {
    if (g.paymentStatus === "PENDING") pending = g._count._all;
    if (g.paymentStatus === "PAID") confirmed = g._count._all;
  }
  return { pending, confirmed };
}
