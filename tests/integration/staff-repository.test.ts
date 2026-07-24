import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import {
  createService,
  createStaffMember,
  deleteStaffMember,
  getStaffMemberById,
  listStaffMembers,
  setStaffMemberActive,
  StaffMemberHasAppointmentsError,
  StaffMemberNotFoundError,
  updateStaffMember,
} from "@/modules/catalog";
import { createAppointment } from "@/modules/scheduling";

const TIMEZONE = "America/Bogota";

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
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
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

  it("un miembro nuevo se crea activo por default", async () => {
    const created = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });
    expect(created.active).toBe(true);
  });

  it("actualiza nombre y rol de un miembro existente", async () => {
    const created = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });

    const updated = await updateStaffMember(businessId, created.id, {
      name: "Juan Pérez Actualizado",
      role: "Barbero senior",
    });

    expect(updated).toMatchObject({ name: "Juan Pérez Actualizado", role: "Barbero senior" });
    const found = await getStaffMemberById(businessId, created.id);
    expect(found).toMatchObject({ name: "Juan Pérez Actualizado", role: "Barbero senior" });
  });

  it("updateStaffMember tira StaffMemberNotFoundError si el id no existe o es de otro negocio", async () => {
    await expect(
      updateStaffMember(businessId, "no-existe", { name: "Nombre válido", role: "Rol válido" }),
    ).rejects.toThrow(StaffMemberNotFoundError);
  });

  it("desactiva y reactiva un miembro del equipo", async () => {
    const created = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });

    const deactivated = await setStaffMemberActive(businessId, created.id, false);
    expect(deactivated.active).toBe(false);

    const reactivated = await setStaffMemberActive(businessId, created.id, true);
    expect(reactivated.active).toBe(true);
  });

  it("borra un miembro del equipo que nunca tuvo citas", async () => {
    const created = await createStaffMember(businessId, { name: "Juan Pérez", role: "Barbero" });

    await deleteStaffMember(businessId, created.id);

    const found = await getStaffMemberById(businessId, created.id);
    expect(found).toBeNull();
  });

  it("rechaza borrar un miembro con citas asociadas — sugiere desactivar en vez de borrar", async () => {
    const staffMember = await createStaffMember(businessId, { name: "Ana", role: "Barbera" });
    const service = await createService(businessId, {
      name: "Corte",
      price: 25000,
      durationMinutes: 30,
    });
    await createAppointment(businessId, TIMEZONE, {
      staffId: staffMember.id,
      serviceId: service.id,
      clientName: "Cliente de prueba",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });

    await expect(deleteStaffMember(businessId, staffMember.id)).rejects.toThrow(
      StaffMemberHasAppointmentsError,
    );

    // No se borró — sigue existiendo.
    const found = await getStaffMemberById(businessId, staffMember.id);
    expect(found).not.toBeNull();
  });
});
