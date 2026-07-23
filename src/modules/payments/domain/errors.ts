import { AppError } from "@/lib/errors";

/**
 * La cita no existe, no pertenece a este negocio, o directamente no fue
 * encontrada al intentar registrar/consultar un pago. Este módulo define su
 * propio error en vez de reusar el de `scheduling` — `payments/` no importa
 * nada de `scheduling`, para mantenerse completamente desacoplado.
 */
export class PaymentAppointmentNotFoundError extends AppError {
  readonly code = "PAYMENT_APPOINTMENT_NOT_FOUND";

  constructor(message = "Esa cita no existe.") {
    super(message);
  }
}

/** No se puede confirmar un pago de una cita cancelada. */
export class AppointmentCancelledForPaymentError extends AppError {
  readonly code = "APPOINTMENT_CANCELLED_FOR_PAYMENT";

  constructor(message = "No se puede confirmar el pago de una cita cancelada.") {
    super(message);
  }
}

/** Ya existe un pago activo para esta cita — no se permiten dos pagos activos a la vez. */
export class PaymentAlreadyConfirmedError extends AppError {
  readonly code = "PAYMENT_ALREADY_CONFIRMED";

  constructor(message = "Esta cita ya tiene un pago confirmado.") {
    super(message);
  }
}

/** No hay ningún pago activo para revertir en esta cita. */
export class NoActivePaymentError extends AppError {
  readonly code = "NO_ACTIVE_PAYMENT";

  constructor(message = "Esta cita no tiene ningún pago confirmado para revertir.") {
    super(message);
  }
}
