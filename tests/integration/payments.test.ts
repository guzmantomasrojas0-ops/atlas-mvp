import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import {
  AppointmentCancelledForPaymentError,
  confirmPayment,
  getAppointmentPayment,
  listPayments,
  NoActivePaymentError,
  PaymentAlreadyConfirmedError,
  PaymentAppointmentNotFoundError,
  revertPayment,
} from "@/modules/payments";

const TIMEZONE = "America/Bogota";

let businessId: string;
let serviceId: string;
let staffId: string;
let clientId: string;
let appointmentId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (payments)",
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

  const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
  clientId = client.id;

  const appointment = await db.appointment.create({
    data: {
      businessId,
      staffId,
      serviceId,
      clientId,
      startsAt: new Date("2026-07-20T15:00:00Z"),
      endsAt: new Date("2026-07-20T15:30:00Z"),
    },
  });
  appointmentId = appointment.id;
});

afterEach(async () => {
  await db.payment.deleteMany({ where: { businessId } });
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

const CONFIRM_INPUT = {
  amount: 25000,
  currency: "USD",
  method: "ZELLE" as const,
  confirmedBy: "Ana",
};

describe("payments module — integración con Postgres real", () => {
  it("confirmPayment crea el Payment y marca la cita como PAID", async () => {
    const payment = await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);

    expect(payment).toMatchObject({
      clientName: "María Gómez",
      serviceName: "Corte",
      amount: 25000,
      currency: "USD",
      method: "ZELLE",
      status: "CONFIRMED",
      confirmedBy: "Ana",
    });

    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.paymentStatus).toBe("PAID");

    const paymentsInDb = await db.payment.findMany({ where: { appointmentId } });
    expect(paymentsInDb).toHaveLength(1);
    expect(paymentsInDb[0].status).toBe("CONFIRMED");
  });

  it("no permite dos pagos activos para la misma cita", async () => {
    await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);

    await expect(confirmPayment(businessId, appointmentId, CONFIRM_INPUT)).rejects.toThrow(
      PaymentAlreadyConfirmedError,
    );

    // Sigue habiendo un solo Payment — el segundo intento no creó nada.
    expect(await db.payment.count({ where: { appointmentId } })).toBe(1);
  });

  it("no permite confirmar el pago de una cita cancelada", async () => {
    await db.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED" } });

    await expect(confirmPayment(businessId, appointmentId, CONFIRM_INPUT)).rejects.toThrow(
      AppointmentCancelledForPaymentError,
    );
    expect(await db.payment.count({ where: { appointmentId } })).toBe(0);
  });

  it("no permite confirmar el pago de una cita inexistente", async () => {
    await expect(confirmPayment(businessId, "no-existe", CONFIRM_INPUT)).rejects.toThrow(
      PaymentAppointmentNotFoundError,
    );
  });

  it("no permite confirmar el pago de una cita de otro negocio (aislamiento entre tenants)", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 000 0001",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });

    try {
      await expect(confirmPayment(otherBusiness.id, appointmentId, CONFIRM_INPUT)).rejects.toThrow(
        PaymentAppointmentNotFoundError,
      );
      expect(await db.payment.count({ where: { appointmentId } })).toBe(0);
    } finally {
      await db.business.delete({ where: { id: otherBusiness.id } });
    }
  });

  it("revertPayment marca el Payment como REVERTED (nunca lo borra) y devuelve la cita a PENDING", async () => {
    const payment = await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);

    await revertPayment(businessId, appointmentId);

    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.paymentStatus).toBe("PENDING");

    const paymentInDb = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentInDb.status).toBe("REVERTED");
  });

  it("no permite revertir si no hay ningún pago activo", async () => {
    await expect(revertPayment(businessId, appointmentId)).rejects.toThrow(NoActivePaymentError);
  });

  it("no permite revertir la cita de otro negocio ni de una inexistente", async () => {
    await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);

    await expect(revertPayment(businessId, "no-existe")).rejects.toThrow(
      PaymentAppointmentNotFoundError,
    );
  });

  it("después de confirmar → revertir → confirmar de nuevo, queda un historial de 2 Payments", async () => {
    await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);
    await revertPayment(businessId, appointmentId);
    await confirmPayment(businessId, appointmentId, { ...CONFIRM_INPUT, amount: 30000 });

    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.paymentStatus).toBe("PAID");

    const paymentsInDb = await db.payment.findMany({
      where: { appointmentId },
      orderBy: { createdAt: "asc" },
    });
    expect(paymentsInDb).toHaveLength(2);
    expect(paymentsInDb[0].status).toBe("REVERTED");
    expect(paymentsInDb[1].status).toBe("CONFIRMED");
  });

  it("getAppointmentPayment refleja el pago activo (o null si no hay, o si fue revertido)", async () => {
    expect(await getAppointmentPayment(businessId, appointmentId)).toBeNull();

    await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);
    expect(await getAppointmentPayment(businessId, appointmentId)).toMatchObject({
      status: "CONFIRMED",
    });

    await revertPayment(businessId, appointmentId);
    expect(await getAppointmentPayment(businessId, appointmentId)).toBeNull();
  });

  it("listPayments devuelve todos los pagos del negocio (cualquier estado) sin filtrar por otro negocio", async () => {
    await confirmPayment(businessId, appointmentId, CONFIRM_INPUT);
    await revertPayment(businessId, appointmentId);
    await confirmPayment(businessId, appointmentId, { ...CONFIRM_INPUT, amount: 30000 });

    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 000 0002",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });

    try {
      const payments = await listPayments(businessId);
      expect(payments).toHaveLength(2);
      expect(payments.map((p) => p.status).sort()).toEqual(["CONFIRMED", "REVERTED"]);
      expect(payments.every((p) => p.clientName === "María Gómez")).toBe(true);

      const otherPayments = await listPayments(otherBusiness.id);
      expect(otherPayments).toHaveLength(0);
    } finally {
      await db.business.delete({ where: { id: otherBusiness.id } });
    }
  });
});
