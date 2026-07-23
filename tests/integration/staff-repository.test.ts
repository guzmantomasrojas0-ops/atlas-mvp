import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createStaffMember, listStaffMembers } from "@/modules/catalog";

let businessId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (staff)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: "America/Bogota",
    businessType: "BARBERSHOP",
  });
  businessId = business.id;
});

afterEach(async () => {
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("catalog module (staff) — integración con Postgres real", () => {
  it("persiste un miembro del equipo con todos sus campos", async () => {
    const created = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });

    const found = await db.staffMember.findUnique({ where: { id: created.id } });
    expect(found).toMatchObject({
      businessId,
      name: "Juan Pérez",
      role: "Barbero",
    });
  });

  it("lista el equipo de un negocio ordenado por creación", async () => {
    await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });
    await createStaffMember(businessId, { name: "Ana Gómez", role: "Estilista" });

    const staffMembers = await listStaffMembers(businessId);

    expect(staffMembers).toHaveLength(2);
    expect(staffMembers[0]).toMatchObject({ name: "Juan Pérez", role: "Barbero" });
    expect(staffMembers[1]).toMatchObject({ name: "Ana Gómez", role: "Estilista" });
  });

  it("rechaza datos inválidos antes de tocar la base", async () => {
    const before = await db.staffMember.count({ where: { businessId } });

    await expect(createStaffMember(businessId, { name: "a", role: "" })).rejects.toThrow(ZodError);

    const after = await db.staffMember.count({ where: { businessId } });
    expect(after).toBe(before);
  });
});
