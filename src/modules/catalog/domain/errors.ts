import { AppError } from "@/lib/errors";

/** El miembro del equipo no existe, o no pertenece a este negocio. */
export class StaffMemberNotFoundError extends AppError {
  readonly code = "STAFF_MEMBER_NOT_FOUND";

  constructor(message = "Ese miembro del equipo no existe.") {
    super(message);
  }
}

/**
 * Se intentó borrar un miembro del equipo que ya tiene citas asociadas — la
 * FK de `Appointment.staffId` es RESTRICT (ver PLAN.md), así que un borrado
 * real rompería el historial de esas citas. Desactivar (no aparece más para
 * reservas nuevas, pero conserva el historial) es la alternativa correcta.
 */
export class StaffMemberHasAppointmentsError extends AppError {
  readonly code = "STAFF_MEMBER_HAS_APPOINTMENTS";

  constructor(
    message = "Este miembro del equipo tiene reservas asociadas — desactívalo en vez de eliminarlo.",
  ) {
    super(message);
  }
}
