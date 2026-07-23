import { db } from "@/lib/db";

export interface CreateAppointmentInput {
  businessId: string;
  staffId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
}

export function createAppointment(input: CreateAppointmentInput) {
  return db.appointment.create({ data: input });
}

/** Reservas confirmadas que se superponen con [rangeStart, rangeEnd) — para pintar el calendario. */
export function listAppointmentsInRange(businessId: string, rangeStart: Date, rangeEnd: Date) {
  return db.appointment.findMany({
    where: {
      businessId,
      status: "CONFIRMED",
      startsAt: { lt: rangeEnd },
      endsAt: { gt: rangeStart },
    },
    include: { staff: true, service: true, client: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Reservas confirmadas de un miembro del equipo que se superponen con
 * [startsAt, endsAt) — el chequeo de conflicto a nivel de aplicación. La
 * garantía real contra condiciones de carrera es el constraint EXCLUDE de
 * Postgres (ver migración `add_appointment_no_overlap_constraint`).
 *
 * `excludeAppointmentId` es para reprogramar: la cita que se está moviendo
 * no debe contarse como "conflicto consigo misma" si su horario viejo
 * todavía se superpone con el nuevo que se está evaluando.
 */
export function findOverlappingAppointments(
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
) {
  return db.appointment.findMany({
    where: {
      staffId,
      status: "CONFIRMED",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });
}

/** Una cita confirmada puntual, acotada al negocio — para reprogramarla. */
export function findConfirmedAppointmentById(businessId: string, appointmentId: string) {
  return db.appointment.findFirst({
    where: { id: appointmentId, businessId, status: "CONFIRMED" },
  });
}

/** Mueve una cita a un nuevo horario, devolviendo las relaciones ya cargadas para el mapeo a `AppointmentListItem`. */
export function updateAppointmentTime(appointmentId: string, startsAt: Date, endsAt: Date) {
  return db.appointment.update({
    where: { id: appointmentId },
    data: { startsAt, endsAt },
    include: { staff: true, service: true, client: true },
  });
}

/** Todas las reservas confirmadas de un cliente (pasadas y futuras) — para el panel de contexto en Conversaciones. */
export function listAppointmentsByClient(businessId: string, clientId: string) {
  return db.appointment.findMany({
    where: { businessId, clientId, status: "CONFIRMED" },
    include: { staff: true, service: true, client: true },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Cancela una reserva, acotado a que sea de este negocio y que todavía esté
 * confirmada (`updateMany` en vez de `update` para no tirar si no matchea —
 * el service decide qué significa `count === 0`: no existe, es de otro
 * negocio, o ya no estaba confirmada).
 */
export function cancelAppointmentById(businessId: string, appointmentId: string) {
  return db.appointment.updateMany({
    where: { id: appointmentId, businessId, status: "CONFIRMED" },
    data: { status: "CANCELLED" },
  });
}
