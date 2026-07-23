"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { ForbiddenError, requireRole, requireSession } from "@/lib/session";
import {
  AppointmentNotFoundError,
  cancelAppointment,
  createAppointment,
  InvalidReferenceError,
  OutsideBusinessHoursError,
  rescheduleAppointment,
  SchedulingConflictError,
  type AppointmentInput,
  type AppointmentListItem,
  type RescheduleAppointmentInput,
} from "@/modules/scheduling";
import {
  AppointmentCancelledForPaymentError,
  confirmPayment,
  NoActivePaymentError,
  PaymentAlreadyConfirmedError,
  PaymentAppointmentNotFoundError,
  revertPayment,
  type ConfirmPaymentInput,
} from "@/modules/payments";

export type CreateAppointmentActionResult = { success: true } | { success: false; error: string };
export type CancelAppointmentActionResult = { success: true } | { success: false; error: string };
export type ConfirmPaymentActionResult =
  { success: true; paymentStatus: "PENDING" | "PAID" } | { success: false; error: string };
export type RevertPaymentActionResult =
  { success: true; paymentStatus: "PENDING" | "PAID" } | { success: false; error: string };
export type RescheduleAppointmentActionResult =
  { success: true; appointment: AppointmentListItem } | { success: false; error: string };

export async function createAppointmentAction(
  input: AppointmentInput,
): Promise<CreateAppointmentActionResult> {
  const { business } = await requireSession();

  try {
    await createAppointment(business.id, business.timezone, input);
  } catch (error) {
    if (error instanceof SchedulingConflictError || error instanceof InvalidReferenceError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá los datos ingresados." };
    }
    logger.error({ error }, "createAppointmentAction: error inesperado guardando la reserva.");
    return { success: false, error: "No se pudo guardar la reserva. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/appointments");
  return { success: true };
}

/** Cancela una reserva existente. */
export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<CancelAppointmentActionResult> {
  const { business } = await requireSession();

  try {
    await cancelAppointment(business.id, appointmentId);
  } catch (error) {
    if (error instanceof AppointmentNotFoundError) {
      return { success: false, error: error.message };
    }
    logger.error(
      { error, appointmentId },
      "cancelAppointmentAction: error inesperado cancelando la reserva.",
    );
    return { success: false, error: "No se pudo cancelar la reserva. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/appointments");
  return { success: true };
}

/**
 * Confirma que el negocio recibió un pago manual (Zelle) para esta cita.
 * Toda la validación (cita cancelada, pago ya activo, cita inexistente)
 * vive en `modules/payments` — acá solo se traduce el error a un mensaje.
 * Solo Owner/Manager: `canManagePayments` es la única fuente de verdad para
 * esa regla (ver `modules/auth/domain/permissions.ts`).
 */
export async function confirmPaymentAction(
  appointmentId: string,
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  try {
    await confirmPayment(business.id, appointmentId, input);
  } catch (error) {
    if (
      error instanceof PaymentAppointmentNotFoundError ||
      error instanceof AppointmentCancelledForPaymentError ||
      error instanceof PaymentAlreadyConfirmedError
    ) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá los datos del pago." };
    }
    logger.error(
      { error, appointmentId },
      "confirmPaymentAction: error inesperado confirmando el pago.",
    );
    return { success: false, error: "No se pudo confirmar el pago. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/payments");
  return { success: true, paymentStatus: "PAID" };
}

/** Revierte el pago confirmado de esta cita — la vuelve a marcar como pendiente. Solo Owner/Manager. */
export async function revertPaymentAction(
  appointmentId: string,
): Promise<RevertPaymentActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  try {
    await revertPayment(business.id, appointmentId);
  } catch (error) {
    if (error instanceof PaymentAppointmentNotFoundError || error instanceof NoActivePaymentError) {
      return { success: false, error: error.message };
    }
    logger.error(
      { error, appointmentId },
      "revertPaymentAction: error inesperado revirtiendo el pago.",
    );
    return { success: false, error: "No se pudo revertir el pago. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/payments");
  return { success: true, paymentStatus: "PENDING" };
}

/**
 * Mueve una reserva confirmada a un nuevo horario. Toda la validación
 * (servicio/staff siguen existiendo, dentro del horario de atención, sin
 * conflictos) vive en `modules/scheduling` — reutiliza exactamente la misma
 * lógica que crear una reserva, no hay nada nuevo que validar acá.
 */
export async function rescheduleAppointmentAction(
  appointmentId: string,
  input: RescheduleAppointmentInput,
): Promise<RescheduleAppointmentActionResult> {
  const { business } = await requireSession();

  let appointment: AppointmentListItem;
  try {
    appointment = await rescheduleAppointment(business.id, business.timezone, appointmentId, input);
  } catch (error) {
    if (
      error instanceof AppointmentNotFoundError ||
      error instanceof SchedulingConflictError ||
      error instanceof InvalidReferenceError ||
      error instanceof OutsideBusinessHoursError
    ) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá la fecha y el horario." };
    }
    logger.error(
      { error, appointmentId },
      "rescheduleAppointmentAction: error inesperado reprogramando la reserva.",
    );
    return { success: false, error: "No se pudo reprogramar la reserva. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/appointments");
  return { success: true, appointment };
}
