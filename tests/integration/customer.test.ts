import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { findOrCreateConversation, sendMessage } from "@/modules/conversation";
import {
  CustomerNotFoundError,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "@/modules/customer";
import { confirmPayment } from "@/modules/payments";

const TIMEZONE = "America/Bogota";

let businessId: string;
let serviceId: string;
let staffId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (customer)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;

  const service = await createService(businessId, {
    name: "Corte",
    price: 25000,
    durationMinutes: 30,
  });
  serviceId = service.id;

  const staffMember = await createStaffMember(businessId, { name: "Ana", role: "Barbera" });
  staffId = staffMember.id;
});

afterEach(async () => {
  await db.message.deleteMany({ where: { conversation: { businessId } } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.payment.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

function createAppointmentRecord(
  clientId: string,
  startsAt: Date,
  status: "CONFIRMED" | "CANCELLED",
) {
  return db.appointment.create({
    data: {
      businessId,
      staffId,
      serviceId,
      clientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60_000),
      status,
    },
  });
}

describe("customer module — integración con Postgres real", () => {
  it("cuenta todas las reservas históricas, pero 'última visita' ignora las canceladas", async () => {
    const client = await db.client.create({
      data: { businessId, name: "Con historial", phone: "+57 301 000 0000" },
    });

    await createAppointmentRecord(client.id, new Date("2026-07-10T15:00:00Z"), "CONFIRMED");
    const mostRecentConfirmed = await createAppointmentRecord(
      client.id,
      new Date("2026-07-24T15:00:00Z"),
      "CONFIRMED",
    );
    // Cronológicamente la más nueva, pero cancelada — no debe contar como visita.
    await createAppointmentRecord(client.id, new Date("2026-07-30T15:00:00Z"), "CANCELLED");

    const customers = await listCustomers(businessId);
    const found = customers.find((c) => c.id === client.id);

    expect(found).toMatchObject({
      id: client.id,
      name: "Con historial",
      phone: "+57 301 000 0000",
      appointmentCount: 3,
    });
    expect(found?.lastVisit?.toISOString()).toBe(mostRecentConfirmed.startsAt.toISOString());
  });

  it("un cliente sin ninguna reserva tiene appointmentCount 0 y lastVisit null", async () => {
    const client = await db.client.create({
      data: { businessId, name: "Sin reservas", phone: null },
    });

    const customers = await listCustomers(businessId);
    const found = customers.find((c) => c.id === client.id);

    expect(found).toMatchObject({ appointmentCount: 0, lastVisit: null, phone: null });
  });

  it("no devuelve clientes de otro negocio", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 000 0001",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });

    try {
      await db.client.create({ data: { businessId, name: "Cliente propio" } });
      await db.client.create({ data: { businessId: otherBusiness.id, name: "Cliente ajeno" } });

      const customers = await listCustomers(businessId);
      expect(customers.map((c) => c.name)).toContain("Cliente propio");
      expect(customers.map((c) => c.name)).not.toContain("Cliente ajeno");
    } finally {
      await db.client.deleteMany({ where: { businessId: otherBusiness.id } });
      await db.business.delete({ where: { id: otherBusiness.id } });
    }
  });

  it("getCustomerDetail agrega reservas, pagos y conversaciones del cliente", async () => {
    const client = await db.client.create({
      data: { businessId, name: "Cliente completo", phone: "+57 302 000 0000" },
    });

    const appointment = await db.appointment.create({
      data: {
        businessId,
        staffId,
        serviceId,
        clientId: client.id,
        startsAt: new Date("2026-07-24T15:00:00Z"),
        endsAt: new Date("2026-07-24T15:30:00Z"),
        status: "CONFIRMED",
      },
    });
    await confirmPayment(businessId, appointment.id, {
      amount: 25000,
      currency: "USD",
      method: "ZELLE",
      confirmedBy: "Ana",
    });
    const conversation = await findOrCreateConversation(businessId, client.id, "WHATSAPP");
    await sendMessage(businessId, conversation.id, "Hola, ¿tienen turno mañana?", "CLIENT");

    const detail = await getCustomerDetail(businessId, client.id);

    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({ id: client.id, name: "Cliente completo" });
    expect(detail?.appointments).toHaveLength(1);
    expect(detail?.appointments[0]).toMatchObject({ id: appointment.id, paymentStatus: "PAID" });
    expect(detail?.payments).toHaveLength(1);
    expect(detail?.payments[0]).toMatchObject({ status: "CONFIRMED", amount: 25000 });
    expect(detail?.conversations).toHaveLength(1);
    expect(detail?.conversations[0]).toMatchObject({ id: conversation.id, channel: "WHATSAPP" });
  });

  it("getCustomerDetail devuelve null si el cliente no existe o es de otro negocio", async () => {
    const detail = await getCustomerDetail(businessId, "no-existe");
    expect(detail).toBeNull();
  });

  it("updateCustomer actualiza nombre y teléfono", async () => {
    const client = await db.client.create({
      data: { businessId, name: "Nombre viejo", phone: "+57 300 000 0000" },
    });

    const updated = await updateCustomer(businessId, client.id, {
      name: "Nombre nuevo",
      phone: "+57 301 111 1111",
    });

    expect(updated).toMatchObject({ name: "Nombre nuevo", phone: "+57 301 111 1111" });
  });

  it("updateCustomer tira CustomerNotFoundError si el id no existe o es de otro negocio", async () => {
    await expect(
      updateCustomer(businessId, "no-existe", { name: "Nombre válido", phone: "" }),
    ).rejects.toThrow(CustomerNotFoundError);
  });
});
