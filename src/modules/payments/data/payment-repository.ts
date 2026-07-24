import { db } from "@/lib/db";
import type { PaymentMethodValue } from "../domain";

/**
 * `payments/` lee `Appointment` directamente (no a través de `scheduling`) —
 * igual que `Client` ya lo leen tanto `scheduling` como `conversation` y
 * `customer` desde sus propias capas de datos. Ningún modelo de Prisma es
 * "propiedad" exclusiva de un solo módulo.
 */
export function findAppointmentForPayment(businessId: string, appointmentId: string) {
  return db.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: { client: true, service: true },
  });
}

/** El pago actualmente vigente (no revertido) de una cita, si existe. */
export function findActivePayment(appointmentId: string) {
  return db.payment.findFirst({
    where: { appointmentId, status: "CONFIRMED" },
  });
}

export interface CreatePaymentInput {
  businessId: string;
  appointmentId: string;
  amount: number;
  currency: string;
  method: PaymentMethodValue;
  notes?: string;
  confirmedBy: string;
  confirmedAt: Date;
}

/**
 * Crea el registro de pago y marca la cita como pagada en una sola
 * transacción — nunca deben quedar desincronizados.
 */
export function createPaymentAndMarkPaid(input: CreatePaymentInput) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        businessId: input.businessId,
        appointmentId: input.appointmentId,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
        notes: input.notes,
        confirmedBy: input.confirmedBy,
        confirmedAt: input.confirmedAt,
      },
    });
    await tx.appointment.update({
      where: { id: input.appointmentId },
      data: { paymentStatus: "PAID" },
    });
    return payment;
  });
}

/**
 * Revierte un pago (lo marca REVERTED, nunca lo borra — es el historial de
 * auditoría) y devuelve la cita a PENDING, en una sola transacción.
 */
export function revertPaymentAndMarkPending(paymentId: string, appointmentId: string) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REVERTED" },
    });
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: "PENDING" },
    });
    return payment;
  });
}

/** Todos los pagos de un negocio (cualquier estado), más recientes primero — para el Dashboard. */
export function listPaymentsByBusiness(businessId: string) {
  return db.payment.findMany({
    where: { businessId },
    include: { appointment: { include: { client: true, service: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Todos los pagos de un cliente puntual (cualquier estado) — para su historial en la ficha de Cliente. */
export function listPaymentsByClient(businessId: string, clientId: string) {
  return db.payment.findMany({
    where: { businessId, appointment: { clientId } },
    include: { appointment: { include: { client: true, service: true } } },
    orderBy: { createdAt: "desc" },
  });
}
