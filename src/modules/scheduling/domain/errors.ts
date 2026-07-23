import { AppError } from "@/lib/errors";

/** Se intentó agendar un horario que ya está ocupado para ese miembro del equipo. */
export class SchedulingConflictError extends AppError {
  readonly code = "SCHEDULING_CONFLICT";

  constructor(message = "Ese horario ya está ocupado para este miembro del equipo.") {
    super(message);
  }
}

/** El staffId o serviceId recibido no existe (o no pertenece a este negocio). */
export class InvalidReferenceError extends AppError {
  readonly code = "INVALID_REFERENCE";
}

/** El horario pedido cae fuera de la ventana de atención del negocio. */
export class OutsideBusinessHoursError extends AppError {
  readonly code = "OUTSIDE_BUSINESS_HOURS";

  constructor(message = "Ese horario está fuera del horario de atención del negocio.") {
    super(message);
  }
}

/** La reserva no existe, no pertenece a este negocio, o ya no está confirmada. */
export class AppointmentNotFoundError extends AppError {
  readonly code = "APPOINTMENT_NOT_FOUND";

  constructor(message = "Esa reserva no existe o ya no está confirmada.") {
    super(message);
  }
}
