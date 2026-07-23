import { afterEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";

const createdIds: string[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await db.business.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("business module — integración con Postgres real", () => {
  it("persiste un negocio con todos sus campos", async () => {
    const created = await createBusiness({
      name: "Test Business",
      phone: "+57 300 000 0000",
      address: "Calle Falsa 123",
      timezone: "America/Bogota",
      businessType: "BARBERSHOP",
    });
    createdIds.push(created.id);

    const found = await db.business.findUnique({ where: { id: created.id } });
    expect(found).toMatchObject({
      name: "Test Business",
      phone: "+57 300 000 0000",
      address: "Calle Falsa 123",
      timezone: "America/Bogota",
      businessType: "BARBERSHOP",
    });
  });

  it("rechaza datos inválidos antes de tocar la base", async () => {
    const before = await db.business.count();

    await expect(
      createBusiness({
        name: "a",
        phone: "x",
        address: "abc",
        timezone: "Not/AZone",
        businessType: "BARBERSHOP",
      }),
    ).rejects.toThrow(ZodError);

    const after = await db.business.count();
    expect(after).toBe(before);
  });
});
