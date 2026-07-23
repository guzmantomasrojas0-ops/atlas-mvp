import {
  AppointmentCancelledForPaymentError,
  confirmPaymentInputSchema,
  NoActivePaymentError,
  PaymentAlreadyConfirmedError,
  PaymentAppointmentNotFoundError,
  type ConfirmPaymentInput,
  type PaymentMethodValue,
  type PaymentRecordStatusValue,
} from "./domain";
import {
  createPaymentAndMarkPaid,
  findActivePayment,
  findAppointmentForPayment,
  listPaymentsByBusiness,
  revertPaymentAndMarkPending,
} from "./data";

export interface PaymentListItem {
  id: string;
  appointmentId: string;
  clientName: string;
  serviceName: string;
  amount: number;
  currency: string;
  method: PaymentMethodValue;
  status: PaymentRecordStatusValue;
  notes: string | null;
  confirmedBy: string;
  createdAt: Date;
  confirmedAt: Date;
}

interface RawPaymentWithAppointment {
  id: string;
  appointmentId: string;
  amount: { toNumber(): number };
  currency: string;
  method: PaymentMethodValue;
  status: PaymentRecordStatusValue;
  notes: string | null;
  confirmedBy: string;
  createdAt: Date;
  confirmedAt: Date;
  appointment: { client: { name: string }; service: { name: string } };
}

function toPaymentListItem(payment: RawPaymentWithAppointment): PaymentListItem {
  return {
    id: payment.id,
    appointmentId: payment.appointmentId,
    clientName: payment.appointment.client.name,
    serviceName: payment.appointment.service.name,
    amount: payment.amount.toNumber(),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    notes: payment.notes,
    confirmedBy: payment.confirmedBy,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
  };
}

/**
 * Confirma que el negocio recibió un pago (hoy siempre por Zelle) para una
 * cita. Siempre re-consulta la cita real — nunca confía en nada que quien
 * llama ya "sepa" de antes — y valida, en este orden: que la cita exista y
 * sea de este negocio, que no esté cancelada, y que no tenga ya un pago
 * activo. Crea el `Payment` y marca `Appointment.paymentStatus = PAID` en
 * una sola transacción (ver `data/payment-repository.ts`).
 */
export async function confirmPayment(
  businessId: string,
  appointmentId: string,
  input: ConfirmPaymentInput,
): Promise<PaymentListItem> {
  const data = confirmPaymentInputSchema.parse(input);

  const appointment = await findAppointmentForPayment(businessId, appointmentId);
  if (!appointment) throw new PaymentAppointmentNotFoundError();
  if (appointment.status === "CANCELLED") throw new AppointmentCancelledForPaymentError();
  if (appointment.paymentStatus === "PAID") throw new PaymentAlreadyConfirmedError();

  const payment = await createPaymentAndMarkPaid({
    businessId,
    appointmentId,
    amount: data.amount,
    currency: data.currency,
    method: data.method,
    notes: data.notes,
    confirmedBy: data.confirmedBy,
    confirmedAt: new Date(),
  });

  return toPaymentListItem({ ...payment, appointment });
}

/**
 * Revierte el pago activo de una cita: lo marca REVERTED (nunca lo borra —
 * es el historial de auditoría) y devuelve `Appointment.paymentStatus` a
 * PENDING, en una sola transacción.
 */
export async function revertPayment(businessId: string, appointmentId: string): Promise<void> {
  const appointment = await findAppointmentForPayment(businessId, appointmentId);
  if (!appointment) throw new PaymentAppointmentNotFoundError();

  const activePayment = await findActivePayment(appointmentId);
  if (!activePayment) throw new NoActivePaymentError();

  await revertPaymentAndMarkPending(activePayment.id, appointmentId);
}

/** El pago actualmente vigente de una cita, o `null` si no tiene ninguno (o fue revertido). */
export async function getAppointmentPayment(
  businessId: string,
  appointmentId: string,
): Promise<PaymentListItem | null> {
  const appointment = await findAppointmentForPayment(businessId, appointmentId);
  if (!appointment) return null;

  const payment = await findActivePayment(appointmentId);
  if (!payment) return null;

  return toPaymentListItem({ ...payment, appointment });
}

/** Todos los pagos de un negocio (cualquier estado), para `/dashboard/payments`. */
export async function listPayments(businessId: string): Promise<PaymentListItem[]> {
  const payments = await listPaymentsByBusiness(businessId);
  return payments.map(toPaymentListItem);
}
