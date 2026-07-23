import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { getAnalyticsOverview } from "@/modules/analytics";

const TIMEZONE = "America/Bogota"; // UTC-5 fijo
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-22T15:00:00.000Z");

let businessId: string;
let corteId: string;
let barbaId: string;
let staffId: string;

/** Un instante UTC para "hora:min hora local de Bogotá" en un día a `daysAgo` del NOW. */
function bogotaAt(daysAgo: number, hour: number, minute = 0): Date {
  const dayBase = new Date(NOW.getTime() - daysAgo * DAY);
  return new Date(
    Date.UTC(
      dayBase.getUTCFullYear(),
      dayBase.getUTCMonth(),
      dayBase.getUTCDate(),
      hour + 5, // Bogotá = UTC-5
      minute,
    ),
  );
}

async function seedClient(name: string, createdDaysAgo: number): Promise<string> {
  const client = await db.client.create({
    data: {
      businessId,
      name,
      phone: "+57 300 555 0000",
      createdAt: new Date(NOW.getTime() - createdDaysAgo * DAY),
    },
  });
  return client.id;
}

async function seedAppointment(opts: {
  clientId: string;
  serviceId: string;
  createdDaysAgo: number;
  startsDaysAgo: number;
  startHour: number;
  status?: "CONFIRMED" | "CANCELLED";
  paymentStatus?: "PENDING" | "PAID";
}): Promise<string> {
  const startsAt = bogotaAt(opts.startsDaysAgo, opts.startHour);
  const appointment = await db.appointment.create({
    data: {
      businessId,
      staffId,
      serviceId: opts.serviceId,
      clientId: opts.clientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: opts.status ?? "CONFIRMED",
      paymentStatus: opts.paymentStatus ?? "PENDING",
      createdAt: new Date(NOW.getTime() - opts.createdDaysAgo * DAY),
    },
  });
  return appointment.id;
}

async function seedPayment(appointmentId: string, amount: number, confirmedDaysAgo: number) {
  await db.payment.create({
    data: {
      businessId,
      appointmentId,
      amount,
      currency: "USD",
      method: "ZELLE",
      status: "CONFIRMED",
      confirmedBy: "Ana",
      confirmedAt: new Date(NOW.getTime() - confirmedDaysAgo * DAY),
    },
  });
}

async function seedWhatsappConversation(clientId: string, createdDaysAgo: number) {
  await db.conversation.create({
    data: {
      businessId,
      clientId,
      channel: "WHATSAPP",
      createdAt: new Date(NOW.getTime() - createdDaysAgo * DAY),
    },
  });
}

beforeEach(async () => {
  const business = await createBusiness({
    name: "Barbería Analytics",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;
  corteId = (await createService(businessId, { name: "Corte", price: 25000, durationMinutes: 30 }))
    .id;
  barbaId = (await createService(businessId, { name: "Barba", price: 15000, durationMinutes: 30 }))
    .id;
  staffId = (await createStaffMember(businessId, { name: "Ana", role: "Barbera" })).id;
});

afterEach(async () => {
  await db.payment.deleteMany({ where: { businessId } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("analytics — agregaciones contra Postgres real", () => {
  it("cuenta clientes nuevos solo dentro del período", async () => {
    await seedClient("Reciente 1", 5);
    await seedClient("Reciente 2", 20);
    await seedClient("Viejo", 40); // fuera de 30d

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.newClients).toBe(2);

    const wide = await getAnalyticsOverview(businessId, TIMEZONE, "90d", NOW);
    expect(wide.newClients).toBe(3);
  });

  it("cuenta reservas por estado y calcula la tasa de cancelación", async () => {
    const c = await seedClient("Cliente", 10);
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 10,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 11,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 12,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 13,
      status: "CANCELLED",
    });

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.bookingsConfirmed).toBe(3);
    expect(overview.bookingsCancelled).toBe(1);
    expect(overview.bookingsTotal).toBe(4);
    expect(overview.cancellationRate).toBeCloseTo(0.25, 5);
  });

  it("suma ingresos confirmados dentro del período", async () => {
    const c = await seedClient("Cliente", 10);
    const a1 = await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 10,
      startsDaysAgo: 8,
      startHour: 10,
      paymentStatus: "PAID",
    });
    const a2 = await seedAppointment({
      clientId: c,
      serviceId: barbaId,
      createdDaysAgo: 10,
      startsDaysAgo: 8,
      startHour: 11,
      paymentStatus: "PAID",
    });
    await seedPayment(a1, 25000, 8);
    await seedPayment(a2, 15000, 8);
    // Un pago viejo, fuera de 30d — no debe sumar.
    const a3 = await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 50,
      startsDaysAgo: 48,
      startHour: 10,
      paymentStatus: "PAID",
    });
    await seedPayment(a3, 99000, 45);

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.revenueTotal).toBe(40000);
    // Y agrupado por día debe sumar lo mismo.
    const sumByDay = overview.revenueByDay.reduce((acc, p) => acc + p.amount, 0);
    expect(sumByDay).toBe(40000);
  });

  it("rankea los servicios más vendidos por reservas", async () => {
    const c = await seedClient("Cliente", 10);
    // Corte: 3 reservas; Barba: 1.
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 10,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 11,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 12,
    });
    await seedAppointment({
      clientId: c,
      serviceId: barbaId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 13,
    });

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.topServices[0]).toMatchObject({ serviceName: "Corte", bookings: 3 });
    expect(overview.topServices[1]).toMatchObject({ serviceName: "Barba", bookings: 1 });
  });

  it("calcula las horas pico en hora local del negocio", async () => {
    const c = await seedClient("Cliente", 10);
    // Dos citas a las 10:00 Bogotá, una a las 14:00 Bogotá.
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: 3,
      startHour: 10,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: 2,
      startHour: 10,
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: 1,
      startHour: 14,
    });

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    const hour10 = overview.peakHours.find((p) => p.hour === 10);
    const hour14 = overview.peakHours.find((p) => p.hour === 14);
    expect(hour10?.bookings).toBe(2);
    expect(hour14?.bookings).toBe(1);
  });

  it("calcula la conversión de WhatsApp a reserva", async () => {
    const converted = await seedClient("Convirtió", 10);
    const notConverted = await seedClient("No convirtió", 10);
    await seedWhatsappConversation(converted, 8);
    await seedWhatsappConversation(notConverted, 8);
    // Solo "converted" tiene una reserva.
    await seedAppointment({
      clientId: converted,
      serviceId: corteId,
      createdDaysAgo: 7,
      startsDaysAgo: -1,
      startHour: 10,
    });

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.whatsappConversations).toBe(2);
    expect(overview.whatsappConverted).toBe(1);
    expect(overview.whatsappConversionRate).toBeCloseTo(0.5, 5);
  });

  it("da el snapshot de cobros pendientes vs confirmados (no acotado al período)", async () => {
    const c = await seedClient("Cliente", 10);
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 10,
      paymentStatus: "PAID",
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 11,
      paymentStatus: "PENDING",
    });
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 12,
      paymentStatus: "PENDING",
    });
    // Una cancelada no cuenta en el snapshot (solo CONFIRMED).
    await seedAppointment({
      clientId: c,
      serviceId: corteId,
      createdDaysAgo: 5,
      startsDaysAgo: -1,
      startHour: 13,
      status: "CANCELLED",
      paymentStatus: "PENDING",
    });

    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview.paymentsConfirmed).toBe(1);
    expect(overview.paymentsPending).toBe(2);
  });

  it("un negocio recién creado devuelve todo en cero, sin tirar", async () => {
    const overview = await getAnalyticsOverview(businessId, TIMEZONE, "30d", NOW);
    expect(overview).toMatchObject({
      revenueTotal: 0,
      bookingsTotal: 0,
      cancellationRate: 0,
      newClients: 0,
      whatsappConversionRate: 0,
      paymentsPending: 0,
      paymentsConfirmed: 0,
    });
    expect(overview.topServices).toEqual([]);
    expect(overview.peakHours).toEqual([]);
    expect(overview.revenueByDay).toEqual([]);
  });
});
