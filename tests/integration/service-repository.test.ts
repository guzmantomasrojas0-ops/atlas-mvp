import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, listServices } from "@/modules/catalog";

let businessId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (services)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: "America/Bogota",
    businessType: "BARBERSHOP",
  });
  businessId = business.id;
});

afterEach(async () => {
  await db.service.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("catalog module — integración con Postgres real", () => {
  it("persiste un servicio con todos sus campos", async () => {
    const created = await createService(businessId, {
      name: "Corte de pelo",
      price: 25000,
      durationMinutes: 45,
    });

    const found = await db.service.findUnique({ where: { id: created.id } });
    expect(found).toMatchObject({
      businessId,
      name: "Corte de pelo",
      durationMinutes: 45,
    });
    expect(found?.price.toNumber()).toBe(25000);
  });

  it("lista los servicios de un negocio ordenados por creación, con price como number", async () => {
    await createService(businessId, { name: "Corte", price: 25000, durationMinutes: 30 });
    await createService(businessId, { name: "Barba", price: 15000.5, durationMinutes: 20 });

    const services = await listServices(businessId);

    expect(services).toHaveLength(2);
    expect(services[0]).toMatchObject({ name: "Corte", price: 25000, durationMinutes: 30 });
    expect(services[1]).toMatchObject({ name: "Barba", price: 15000.5, durationMinutes: 20 });
    expect(typeof services[0].price).toBe("number");
  });

  it("rechaza datos inválidos antes de tocar la base", async () => {
    const before = await db.service.count({ where: { businessId } });

    await expect(
      createService(businessId, { name: "a", price: -5, durationMinutes: 0 }),
    ).rejects.toThrow(ZodError);

    const after = await db.service.count({ where: { businessId } });
    expect(after).toBe(before);
  });
});
