import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { listCustomers } from "@/modules/customer";

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
});
