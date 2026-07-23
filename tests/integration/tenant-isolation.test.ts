import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import {
  createService,
  createStaffMember,
  listServices,
  listStaffMembers,
} from "@/modules/catalog";
import {
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  listAppointments,
  getAppointmentsByClient,
  AppointmentNotFoundError,
} from "@/modules/scheduling";
import {
  confirmPayment,
  revertPayment,
  listPayments,
  PaymentAppointmentNotFoundError,
} from "@/modules/payments";
import {
  findOrCreateConversation,
  getConversation,
  listConversations,
  markAsRead,
  sendMessage,
  ConversationNotFoundError,
} from "@/modules/conversation";
import { listCustomers } from "@/modules/customer";
import { runDueNotifications } from "@/modules/notifications";
import { ConsoleAdapter } from "@/modules/messaging";
import { getSessionUser, login, createOwnerAccount } from "@/modules/auth";
import { getCalendarRange } from "@/modules/scheduling/domain";

/**
 * El corazón del Sprint 22: probar que dos negocios distintos NUNCA pueden
 * verse ni tocarse entre sí. Toda la lógica de aislamiento vive en la capa de
 * servicio (una lectura acotada por `businessId` antes de cualquier mutación
 * por id) — acá se verifica ese contrato extremo a extremo contra Postgres
 * real, negocio A vs negocio B.
 */

const TIMEZONE = "America/Bogota";

interface Tenant {
  id: string;
  serviceId: string;
  staffId: string;
  clientId: string;
  appointmentId: string;
}

async function seedTenant(label: string, clientName: string): Promise<Tenant> {
  const business = await createBusiness({
    name: `Negocio ${label}`,
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  const service = await createService(business.id, {
    name: "Corte de pelo",
    price: 25000,
    durationMinutes: 30,
  });
  const staff = await createStaffMember(business.id, { name: `Barbero ${label}`, role: "Barbero" });

  // Una cita a las 10:00 de pasado mañana (dentro de horario, sin chocar con nada).
  const appointment = await createAppointment(business.id, TIMEZONE, {
    staffId: staff.id,
    serviceId: service.id,
    clientName,
    clientPhone: "+57 300 555 0000",
    date: dateInDays(2),
    time: "10:00",
  });

  return {
    id: business.id,
    serviceId: service.id,
    staffId: staff.id,
    clientId: appointment.clientId,
    appointmentId: appointment.id,
  };
}

function dateInDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function cleanup(businessId: string) {
  await db.appointmentNotification.deleteMany({ where: { businessId } });
  await db.payment.deleteMany({ where: { businessId } });
  await db.message.deleteMany({ where: { conversation: { businessId } } });
  await db.channelMapping.deleteMany({ where: { businessId } });
  await db.conversation.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.session.deleteMany({ where: { user: { businessId } } });
  await db.user.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
}

let tenantA: Tenant;
let tenantB: Tenant;

beforeEach(async () => {
  tenantA = await seedTenant("A", "Cliente de A");
  tenantB = await seedTenant("B", "Cliente de B");
});

afterEach(async () => {
  await cleanup(tenantA.id);
  await cleanup(tenantB.id);
});

describe("aislamiento entre negocios (Sprint 22)", () => {
  describe("catálogo (servicios y equipo)", () => {
    it("listServices de A no incluye servicios de B", async () => {
      const services = await listServices(tenantA.id);
      expect(services.every((s) => s.id !== tenantB.serviceId)).toBe(true);
      expect(services.map((s) => s.id)).toContain(tenantA.serviceId);
    });

    it("listStaffMembers de A no incluye equipo de B", async () => {
      const staff = await listStaffMembers(tenantA.id);
      expect(staff.every((s) => s.id !== tenantB.staffId)).toBe(true);
      expect(staff.map((s) => s.id)).toContain(tenantA.staffId);
    });
  });

  describe("clientes", () => {
    it("listCustomers de A no incluye clientes de B", async () => {
      const customers = await listCustomers(tenantA.id);
      const names = customers.map((c) => c.name);
      expect(names).toContain("Cliente de A");
      expect(names).not.toContain("Cliente de B");
    });
  });

  describe("appointments", () => {
    it("listAppointments de A no incluye reservas de B", async () => {
      const { rangeStart, rangeEnd } = getCalendarRange("day", dateInDays(2), TIMEZONE);
      const appointments = await listAppointments(tenantA.id, rangeStart, rangeEnd);
      const ids = appointments.map((a) => a.id);
      expect(ids).toContain(tenantA.appointmentId);
      expect(ids).not.toContain(tenantB.appointmentId);
    });

    it("getAppointmentsByClient no cruza negocios aunque se pase el clientId de B", async () => {
      // Con el clientId de B pero el businessId de A: no debe devolver la cita de B.
      const appointments = await getAppointmentsByClient(tenantA.id, tenantB.clientId);
      expect(appointments).toHaveLength(0);
    });

    it("A no puede cancelar una cita de B", async () => {
      await expect(cancelAppointment(tenantA.id, tenantB.appointmentId)).rejects.toBeInstanceOf(
        AppointmentNotFoundError,
      );
      // La cita de B sigue confirmada.
      const stillConfirmed = await db.appointment.findUnique({
        where: { id: tenantB.appointmentId },
      });
      expect(stillConfirmed?.status).toBe("CONFIRMED");
    });

    it("A no puede reprogramar una cita de B", async () => {
      await expect(
        rescheduleAppointment(tenantA.id, TIMEZONE, tenantB.appointmentId, {
          date: dateInDays(3),
          time: "11:00",
        }),
      ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe("payments", () => {
    it("A no puede confirmar el pago de una cita de B", async () => {
      await expect(
        confirmPayment(tenantA.id, tenantB.appointmentId, {
          amount: 25000,
          currency: "USD",
          method: "ZELLE",
          confirmedBy: "Intruso",
        }),
      ).rejects.toBeInstanceOf(PaymentAppointmentNotFoundError);
    });

    it("A no puede revertir un pago de una cita de B", async () => {
      // B confirma su propio pago primero.
      await confirmPayment(tenantB.id, tenantB.appointmentId, {
        amount: 25000,
        currency: "USD",
        method: "ZELLE",
        confirmedBy: "Dueño de B",
      });
      // A intenta revertirlo — no debe poder.
      await expect(revertPayment(tenantA.id, tenantB.appointmentId)).rejects.toBeInstanceOf(
        PaymentAppointmentNotFoundError,
      );
      // El pago de B sigue vigente.
      const appointmentB = await db.appointment.findUnique({
        where: { id: tenantB.appointmentId },
      });
      expect(appointmentB?.paymentStatus).toBe("PAID");
    });

    it("listPayments de A no incluye pagos de B", async () => {
      await confirmPayment(tenantB.id, tenantB.appointmentId, {
        amount: 25000,
        currency: "USD",
        method: "ZELLE",
        confirmedBy: "Dueño de B",
      });
      const paymentsA = await listPayments(tenantA.id);
      expect(paymentsA).toHaveLength(0);
      const paymentsB = await listPayments(tenantB.id);
      expect(paymentsB).toHaveLength(1);
    });
  });

  describe("conversaciones", () => {
    it("A no puede leer una conversación de B", async () => {
      const conversationB = await findOrCreateConversation(
        tenantB.id,
        tenantB.clientId,
        "WHATSAPP",
      );
      await expect(getConversation(tenantA.id, conversationB.id)).rejects.toBeInstanceOf(
        ConversationNotFoundError,
      );
    });

    it("A no puede enviar un mensaje a una conversación de B", async () => {
      const conversationB = await findOrCreateConversation(
        tenantB.id,
        tenantB.clientId,
        "WHATSAPP",
      );
      await expect(
        sendMessage(tenantA.id, conversationB.id, "Mensaje intruso", "STAFF"),
      ).rejects.toBeInstanceOf(ConversationNotFoundError);
    });

    it("A no puede marcar como leída una conversación de B", async () => {
      const conversationB = await findOrCreateConversation(
        tenantB.id,
        tenantB.clientId,
        "WHATSAPP",
      );
      await expect(markAsRead(tenantA.id, conversationB.id)).rejects.toBeInstanceOf(
        ConversationNotFoundError,
      );
    });

    it("listConversations de A no incluye conversaciones de B", async () => {
      const conversationB = await findOrCreateConversation(
        tenantB.id,
        tenantB.clientId,
        "WHATSAPP",
      );
      const conversationsA = await listConversations(tenantA.id);
      expect(conversationsA.map((c) => c.id)).not.toContain(conversationB.id);
    });
  });

  describe("notifications", () => {
    it("runDueNotifications de A nunca envía recordatorios de las citas de B", async () => {
      // Una cita de B due en las próximas 24h.
      const clientB = await db.client.create({
        data: { businessId: tenantB.id, name: "Due de B", phone: "+57 300 555 0123" },
      });
      const startsAt = new Date(Date.now() + 23.5 * 60 * 60 * 1000);
      await db.appointment.create({
        data: {
          businessId: tenantB.id,
          staffId: tenantB.staffId,
          serviceId: tenantB.serviceId,
          clientId: clientB.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
        },
      });

      const sender = new ConsoleAdapter();
      const summary = await runDueNotifications(
        { id: tenantA.id, name: "Negocio A", timezone: TIMEZONE },
        new Date(),
        sender,
      );

      // A no tiene ninguna cita due → no envía nada, y desde luego nada de B.
      expect(summary).toEqual({ sent: 0, failed: 0, skipped: 0 });
      expect(sender.sent).toHaveLength(0);
      // Y no se creó ningún registro de notificación para citas de B bajo A.
      const notifsUnderA = await db.appointmentNotification.count({
        where: { businessId: tenantA.id },
      });
      expect(notifsUnderA).toBe(0);
    });
  });

  describe("usuarios y sesiones", () => {
    it("la sesión de un usuario de A resuelve businessId = A, nunca B", async () => {
      await createOwnerAccount(tenantA.id, {
        email: "owner-a@example.com",
        password: "contraseña-segura",
        name: "Owner A",
      });
      const { token } = await login({
        email: "owner-a@example.com",
        password: "contraseña-segura",
      });

      const resolved = await getSessionUser(token);
      expect(resolved?.user.businessId).toBe(tenantA.id);
      expect(resolved?.user.businessId).not.toBe(tenantB.id);
    });

    it("dos negocios no pueden compartir el mismo email de usuario", async () => {
      await createOwnerAccount(tenantA.id, {
        email: "compartido@example.com",
        password: "contraseña-segura",
        name: "Owner A",
      });
      // Mismo email en B → debe fallar (email es único global).
      await expect(
        createOwnerAccount(tenantB.id, {
          email: "compartido@example.com",
          password: "otra-contraseña",
          name: "Owner B",
        }),
      ).rejects.toThrow();
    });
  });
});
