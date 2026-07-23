import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { POST } from "@/app/api/cron/notifications/route";

const TIMEZONE = "America/Bogota";
const HOUR = 60 * 60 * 1000;
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function request(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/notifications", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : undefined,
  });
}

/**
 * El endpoint resuelve el negocio con getFirstBusiness() (el más viejo por
 * createdAt) — sin limpiar negocios previos (incluido el que siembra
 * `prisma/seed.ts`, que trae conversaciones/mensajes), el cron podría tomar
 * uno de otro test. Mismo orden que `messaging-whatsapp-webhook.test.ts`.
 */
async function deleteAllBusinesses(): Promise<void> {
  const businesses = await db.business.findMany({ select: { id: true } });
  for (const { id } of businesses) {
    await db.session.deleteMany({ where: { user: { businessId: id } } });
    await db.user.deleteMany({ where: { businessId: id } });
    await db.appointmentNotification.deleteMany({ where: { businessId: id } });
    await db.payment.deleteMany({ where: { businessId: id } });
    await db.channelMapping.deleteMany({ where: { businessId: id } });
    await db.message.deleteMany({ where: { conversation: { businessId: id } } });
    await db.conversation.deleteMany({ where: { businessId: id } });
    await db.appointment.deleteMany({ where: { businessId: id } });
    await db.client.deleteMany({ where: { businessId: id } });
    await db.service.deleteMany({ where: { businessId: id } });
    await db.staffMember.deleteMany({ where: { businessId: id } });
    await db.business.delete({ where: { id } });
  }
}

beforeAll(async () => {
  await deleteAllBusinesses();
});

afterEach(async () => {
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  await deleteAllBusinesses();
});

describe("POST /api/cron/notifications", () => {
  it("responde 500 y no ejecuta nada si CRON_SECRET no está configurado", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(request("Bearer cualquier-cosa"));

    expect(response.status).toBe(500);
  });

  it("responde 401 sin el header Authorization correcto", async () => {
    process.env.CRON_SECRET = "el-secreto";

    const withoutHeader = await POST(request());
    expect(withoutHeader.status).toBe(401);

    const withWrongSecret = await POST(request("Bearer otro-secreto"));
    expect(withWrongSecret.status).toBe(401);
  });

  it("con el secreto correcto pero sin negocio configurado, responde 200 sin enviar nada", async () => {
    process.env.CRON_SECRET = "el-secreto";

    const response = await POST(request("Bearer el-secreto"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it("con el secreto correcto y una cita due, delega en notifications/service y persiste el resultado", async () => {
    process.env.CRON_SECRET = "el-secreto";

    const business = await createBusiness({
      name: "Barbería Sprint 20 — cron",
      phone: "+57 300 000 0003",
      address: "Calle Falsa 321",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });
    const service = await createService(business.id, {
      name: "Corte",
      price: 25000,
      durationMinutes: 30,
    });
    const staff = await createStaffMember(business.id, { name: "Ana", role: "Barbera" });
    const client = await db.client.create({
      data: { businessId: business.id, name: "Rosa Martínez", phone: "+57 300 555 0199" },
    });
    const startsAt = new Date(Date.now() + 23.5 * HOUR);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    await db.appointment.create({
      data: {
        businessId: business.id,
        serviceId: service.id,
        staffId: staff.id,
        clientId: client.id,
        startsAt,
        endsAt,
      },
    });

    const response = await POST(request("Bearer el-secreto"));

    // Sin credenciales de WhatsApp configuradas en este entorno de test, el
    // envío real falla — lo que importa acá es que el endpoint delegó
    // correctamente y el resultado quedó persistido, no que el envío real
    // haya tenido éxito (eso ya lo cubre el test de integración del módulo
    // con un sender inyectado).
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sent: number; failed: number; skipped: number };
    expect(body.sent + body.failed + body.skipped).toBe(1);

    const rows = await db.appointmentNotification.findMany({ where: { businessId: business.id } });
    expect(rows).toHaveLength(1);
  });
});
