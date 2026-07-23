import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { BusinessRef } from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { ConsoleAdapter } from "@/modules/messaging";
import type { MessageSender, OutgoingMessage, SendResult } from "@/modules/messaging";
import { runDueNotifications } from "@/modules/notifications";

const TIMEZONE = "America/Bogota";
const HOUR = 60 * 60 * 1000;

/** Sender falso que se puede configurar para fallar N veces antes de tener éxito — para probar reintentos sin pegarle a la red. */
class FlakySender implements MessageSender {
  callCount = 0;
  readonly sent: { externalConversationId: string; message: OutgoingMessage }[] = [];
  constructor(private readonly failuresBeforeSuccess: number) {}

  async send(externalConversationId: string, message: OutgoingMessage): Promise<SendResult> {
    this.callCount++;
    if (this.callCount <= this.failuresBeforeSuccess) {
      return { success: false, error: "Fallo simulado de red." };
    }
    this.sent.push({ externalConversationId, message });
    return { success: true };
  }
}

let business: BusinessRef;
let businessId: string;
let serviceId: string;
let staffId: string;

async function seedClient(phone: string | null) {
  return db.client.create({
    data: { businessId, name: "Rosa Martínez", phone },
  });
}

async function seedAppointment(
  clientId: string,
  startsAtOffsetHours: number,
  durationMinutes = 30,
) {
  const startsAt = new Date(Date.now() + startsAtOffsetHours * HOUR);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  return db.appointment.create({
    data: { businessId, staffId, serviceId, clientId, startsAt, endsAt },
  });
}

beforeEach(async () => {
  const created = await createBusiness({
    name: "Barbería Sprint 20",
    phone: "+57 300 000 0002",
    address: "Calle Falsa 789",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = created.id;
  business = { id: created.id, name: created.name, timezone: created.timezone };

  const service = await createService(businessId, {
    name: "Corte de pelo",
    price: 25000,
    durationMinutes: 30,
  });
  serviceId = service.id;

  const staff = await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });
  staffId = staff.id;
});

afterEach(async () => {
  await db.appointmentNotification.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("notifications — integración con Postgres real", () => {
  it("envía el recordatorio de 24h cuando corresponde, y lo registra como SENT", async () => {
    const client = await seedClient("+57 300 555 0199");
    const appointment = await seedAppointment(client.id, 23.5);
    const sender = new ConsoleAdapter();

    const summary = await runDueNotifications(business, new Date(), sender);

    expect(summary).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].externalConversationId).toBe("+57 300 555 0199");
    expect(sender.sent[0].message.text).toContain("Rosa Martínez");

    const rows = await db.appointmentNotification.findMany({
      where: { appointmentId: appointment.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "REMINDER_24H", status: "SENT" });
  });

  it("correr dos veces seguidas no reenvía la misma notificación", async () => {
    const client = await seedClient("+57 300 555 0199");
    await seedAppointment(client.id, 23.5);
    const sender = new ConsoleAdapter();

    await runDueNotifications(business, new Date(), sender);
    const secondRun = await runDueNotifications(business, new Date(), sender);

    expect(secondRun).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(1);
  });

  it("una cita sin teléfono se marca SKIPPED, no se reintenta ni se cuenta como fallo", async () => {
    const client = await seedClient(null);
    await seedAppointment(client.id, 23.5);
    const sender = new ConsoleAdapter();

    const summary = await runDueNotifications(business, new Date(), sender);

    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sender.sent).toHaveLength(0);

    // Una segunda corrida no debería volver a intentarlo — SKIPPED es terminal.
    const secondSummary = await runDueNotifications(business, new Date(), sender);
    expect(secondSummary).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });

  it("un envío fallido se reintenta en la próxima corrida hasta lograrlo", async () => {
    const client = await seedClient("+57 300 555 0199");
    await seedAppointment(client.id, 23.5);
    const sender = new FlakySender(1);

    const firstRun = await runDueNotifications(business, new Date(), sender);
    expect(firstRun).toEqual({ sent: 0, failed: 1, skipped: 0 });

    const secondRun = await runDueNotifications(business, new Date(), sender);
    expect(secondRun).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(1);
  });

  it("deja de reintentar después del máximo de intentos", async () => {
    const client = await seedClient("+57 300 555 0199");
    await seedAppointment(client.id, 23.5);
    const sender = new FlakySender(999); // nunca tiene éxito

    await runDueNotifications(business, new Date(), sender);
    await runDueNotifications(business, new Date(), sender);
    const thirdRun = await runDueNotifications(business, new Date(), sender);

    expect(thirdRun).toEqual({ sent: 0, failed: 1, skipped: 0 });
    // Una cuarta corrida ya no reintenta — se agotaron los 3 intentos.
    const fourthRun = await runDueNotifications(business, new Date(), sender);
    expect(fourthRun).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(sender.callCount).toBe(3);
  });

  it("una cita cancelada nunca recibe notificaciones", async () => {
    const client = await seedClient("+57 300 555 0199");
    const appointment = await seedAppointment(client.id, 23.5);
    await db.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
    const sender = new ConsoleAdapter();

    const summary = await runDueNotifications(business, new Date(), sender);

    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(0);
  });

  it("reprogramar la cita hace que se vuelva a enviar el recordatorio para el horario nuevo", async () => {
    const client = await seedClient("+57 300 555 0199");
    const appointment = await seedAppointment(client.id, 23.5);
    const sender = new ConsoleAdapter();

    await runDueNotifications(business, new Date(), sender);
    expect(sender.sent).toHaveLength(1);

    // Reprograma la cita a un horario nuevo, también dentro de la ventana de 24h.
    const newStartsAt = new Date(Date.now() + 23 * HOUR);
    const newEndsAt = new Date(newStartsAt.getTime() + 30 * 60 * 1000);
    await db.appointment.update({
      where: { id: appointment.id },
      data: { startsAt: newStartsAt, endsAt: newEndsAt },
    });

    const secondRun = await runDueNotifications(business, new Date(), sender);
    expect(secondRun).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(2);

    const rows = await db.appointmentNotification.findMany({
      where: { appointmentId: appointment.id, type: "REMINDER_24H" },
    });
    expect(rows).toHaveLength(2);
  });

  it("una cita fuera de la ventana de 24h no genera ninguna notificación", async () => {
    const client = await seedClient("+57 300 555 0199");
    await seedAppointment(client.id, 48);
    const sender = new ConsoleAdapter();

    const summary = await runDueNotifications(business, new Date(), sender);

    expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(sender.sent).toHaveLength(0);
  });
});
