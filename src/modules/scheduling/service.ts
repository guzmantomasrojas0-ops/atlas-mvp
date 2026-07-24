import { getServiceById, getStaffMemberById, listStaffMembers } from "@/modules/catalog";
import type { ServiceListItem, StaffMemberListItem } from "@/modules/catalog";
import {
  AppointmentNotFoundError,
  appointmentInputSchema,
  findAvailableSlots,
  InvalidReferenceError,
  isWithinBusinessHours,
  OutsideBusinessHoursError,
  rescheduleAppointmentInputSchema,
  SchedulingConflictError,
  toUtcInstant,
  type AppointmentInput,
  type RescheduleAppointmentInput,
  type TimeRange,
} from "./domain";
import {
  cancelAppointmentById,
  createAppointment as createAppointmentRecord,
  findConfirmedAppointmentById,
  findOverlappingAppointments,
  listAppointmentsByClient,
  listAppointmentsInRange,
  updateAppointmentTime,
} from "./data/appointment-repository";
import { findOrCreateClient } from "./data/client-repository";

export interface AppointmentListItem {
  id: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  clientId: string;
  clientName: string;
  startsAt: Date;
  endsAt: Date;
  /**
   * Bandera derivada de la propia cita (ver `Appointment.paymentStatus` en
   * el schema) — Scheduling solo la expone tal cual, igual que ya expone
   * `staffName`/`serviceName`. Toda la lógica de cuándo cambia vive en el
   * módulo `payments/`, nunca acá.
   */
  paymentStatus: "PENDING" | "PAID";
}

interface AppointmentWithRelations {
  id: string;
  staffId: string;
  staff: { name: string };
  serviceId: string;
  service: { name: string };
  clientId: string;
  client: { name: string };
  startsAt: Date;
  endsAt: Date;
  paymentStatus: "PENDING" | "PAID";
}

function toAppointmentListItem(appointment: AppointmentWithRelations): AppointmentListItem {
  return {
    id: appointment.id,
    staffId: appointment.staffId,
    staffName: appointment.staff.name,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    clientId: appointment.clientId,
    clientName: appointment.client.name,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    paymentStatus: appointment.paymentStatus,
  };
}

const EXCLUSION_VIOLATION_MARKERS = ["23p01", "appointments_no_overlap", "exclusion"];

/**
 * ¿Este error vino del constraint EXCLUDE de Postgres? Es el backstop real
 * contra doble-reserva bajo condiciones de carrera (dos requests que pasan
 * el chequeo de `findOverlappingAppointments` casi al mismo tiempo) — acá
 * solo lo traducimos a un error de dominio legible.
 */
function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  const meta = "meta" in error ? JSON.stringify((error as { meta?: unknown }).meta ?? {}) : "";
  const haystack = `${message} ${meta}`.toLowerCase();
  return EXCLUSION_VIOLATION_MARKERS.some((marker) => haystack.includes(marker));
}

interface ResolvedAppointmentSlot {
  service: ServiceListItem;
  staffMember: StaffMemberListItem;
  startsAt: Date;
  endsAt: Date;
}

/**
 * El núcleo compartido por cualquier forma de crear una cita, sea quien sea
 * quien la pida (el formulario manual o una Tool del agente): resuelve
 * servicio y staff *de nuevo* contra la base (nunca confía en un dato visto
 * antes en la conversación o en la UI), calcula el rango horario, valida
 * que caiga dentro del horario de atención, y chequea conflictos a nivel de
 * aplicación. No crea nada todavía — cada entry point decide con qué
 * `clientId` crear la cita.
 */
async function resolveAndValidateAppointment(
  businessId: string,
  businessTimezone: string,
  input: { staffId: string; serviceId: string; date: string; time: string },
  excludeAppointmentId?: string,
): Promise<ResolvedAppointmentSlot> {
  const [service, staffMember] = await Promise.all([
    getServiceById(businessId, input.serviceId),
    getStaffMemberById(businessId, input.staffId),
  ]);

  if (!service) throw new InvalidReferenceError("El servicio seleccionado no existe.");
  if (!staffMember) {
    throw new InvalidReferenceError("El miembro del equipo seleccionado no existe.");
  }
  // Un miembro inactivo no puede recibir reservas NUEVAS (Dashboard y agente
  // de IA ya lo excluyen de sus propias listas, pero esta es la validación
  // final y compartida). Reprogramar una cita YA existente con ese mismo
  // miembro sí se permite — `excludeAppointmentId` solo está presente ahí —
  // para no dejar atrapada una cita real solo porque el staff se desactivó
  // después de crearla.
  if (!staffMember.active && !excludeAppointmentId) {
    throw new InvalidReferenceError(
      "Ese miembro del equipo ya no está activo — elige otro para la reserva nueva.",
    );
  }

  const startsAt = toUtcInstant(input.date, input.time, businessTimezone);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  if (!isWithinBusinessHours(startsAt, endsAt, businessTimezone)) {
    throw new OutsideBusinessHoursError();
  }

  const overlapping = await findOverlappingAppointments(
    input.staffId,
    startsAt,
    endsAt,
    excludeAppointmentId,
  );
  if (overlapping.length > 0) {
    throw new SchedulingConflictError();
  }

  return { service, staffMember, startsAt, endsAt };
}

/**
 * Crea el registro en la base, atrapando la violación del constraint
 * EXCLUDE (la garantía real contra condiciones de carrera) y
 * traduciéndola al mismo error de dominio que el chequeo de aplicación.
 */
async function createAppointmentRecordSafely(
  businessId: string,
  staffId: string,
  serviceId: string,
  clientId: string,
  startsAt: Date,
  endsAt: Date,
) {
  try {
    return await createAppointmentRecord({
      businessId,
      staffId,
      serviceId,
      clientId,
      startsAt,
      endsAt,
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new SchedulingConflictError();
    }
    throw error;
  }
}

/**
 * Crea una reserva a nombre de un cliente identificado por nombre (el
 * formulario manual del negocio). Valida con Zod, resuelve la duración
 * desde el servicio real, chequea conflictos a nivel de aplicación, y crea
 * (o reutiliza) el cliente por nombre.
 */
export async function createAppointment(
  businessId: string,
  businessTimezone: string,
  input: AppointmentInput,
) {
  const data = appointmentInputSchema.parse(input);
  const { startsAt, endsAt } = await resolveAndValidateAppointment(
    businessId,
    businessTimezone,
    data,
  );
  const client = await findOrCreateClient(
    businessId,
    data.clientName,
    data.clientPhone || undefined,
  );

  return createAppointmentRecordSafely(
    businessId,
    data.staffId,
    data.serviceId,
    client.id,
    startsAt,
    endsAt,
  );
}

export interface CreateAppointmentForClientInput {
  clientId: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
}

export interface CreatedAppointment {
  id: string;
  service: { id: string; name: string; price: number; durationMinutes: number };
  staff: { id: string; name: string };
  startsAt: Date;
  endsAt: Date;
}

/**
 * Crea una reserva para un cliente ya identificado por id — lo que necesita
 * el agente conversacional, que ya sabe con quién está hablando por la
 * conversación misma. A diferencia de `createAppointment`, nunca busca ni
 * crea un cliente por nombre: hacerlo acá arriesgaría duplicar al cliente
 * real o, peor, agendarle la cita a otra persona con un nombre parecido.
 * Comparte toda la validación con `createAppointment` — nada se duplica.
 */
export async function createAppointmentForClient(
  businessId: string,
  businessTimezone: string,
  input: CreateAppointmentForClientInput,
): Promise<CreatedAppointment> {
  const { service, staffMember, startsAt, endsAt } = await resolveAndValidateAppointment(
    businessId,
    businessTimezone,
    input,
  );

  const record = await createAppointmentRecordSafely(
    businessId,
    input.staffId,
    input.serviceId,
    input.clientId,
    startsAt,
    endsAt,
  );

  return {
    id: record.id,
    service: {
      id: service.id,
      name: service.name,
      price: service.price,
      durationMinutes: service.durationMinutes,
    },
    staff: { id: staffMember.id, name: staffMember.name },
    startsAt: record.startsAt,
    endsAt: record.endsAt,
  };
}

/** Reservas confirmadas que se superponen con [rangeStart, rangeEnd), listas para pintar el calendario. */
export async function listAppointments(
  businessId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<AppointmentListItem[]> {
  const appointments = await listAppointmentsInRange(businessId, rangeStart, rangeEnd);
  return appointments.map(toAppointmentListItem);
}

/** Todas las reservas confirmadas de un cliente (pasadas y futuras) — para el panel de contexto en Conversaciones. */
export async function getAppointmentsByClient(
  businessId: string,
  clientId: string,
): Promise<AppointmentListItem[]> {
  const appointments = await listAppointmentsByClient(businessId, clientId);
  return appointments.map(toAppointmentListItem);
}

/**
 * Cancela una reserva confirmada — la única operación de escritura que
 * cambia el estado de una cita ya creada. `updateMany` en `data` no tira si
 * no matchea nada; acá se traduce ese `count === 0` (no existe, es de otro
 * negocio, o ya no estaba confirmada) a `AppointmentNotFoundError`.
 */
export async function cancelAppointment(businessId: string, appointmentId: string): Promise<void> {
  const { count } = await cancelAppointmentById(businessId, appointmentId);
  if (count === 0) {
    throw new AppointmentNotFoundError();
  }
}

/**
 * Mueve una cita confirmada a un nuevo horario, con el mismo servicio y
 * miembro del equipo. Reutiliza toda la validación de `createAppointment`
 * (resuelve servicio/staff de nuevo, valida horario de atención, chequea
 * conflictos) a través de `resolveAndValidateAppointment` — la única
 * diferencia es que excluye a la propia cita del chequeo de conflictos,
 * para no rechazarla por superponerse con su propio horario viejo.
 */
export async function rescheduleAppointment(
  businessId: string,
  businessTimezone: string,
  appointmentId: string,
  input: RescheduleAppointmentInput,
): Promise<AppointmentListItem> {
  const data = rescheduleAppointmentInputSchema.parse(input);

  const existing = await findConfirmedAppointmentById(businessId, appointmentId);
  if (!existing) throw new AppointmentNotFoundError();

  const { startsAt, endsAt } = await resolveAndValidateAppointment(
    businessId,
    businessTimezone,
    { staffId: existing.staffId, serviceId: existing.serviceId, date: data.date, time: data.time },
    appointmentId,
  );

  let updated;
  try {
    updated = await updateAppointmentTime(appointmentId, startsAt, endsAt);
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new SchedulingConflictError();
    }
    throw error;
  }

  return toAppointmentListItem(updated);
}

export interface StaffAvailability {
  staffId: string;
  staffName: string;
  slots: TimeRange[];
}

/**
 * Horarios libres de un día para un servicio de cierta duración, por cada
 * miembro del equipo activo (o uno puntual, si se pasa `staffId` — y solo si
 * ese miembro sigue activo). Un miembro inactivo nunca debe ofrecerse para
 * una reserva nueva, sea desde el agente de IA o cualquier otro caller. Una
 * sola consulta de reservas para todo el día — no una por miembro del equipo.
 */
export async function searchAvailability(
  businessId: string,
  businessTimezone: string,
  date: string,
  serviceDurationMinutes: number,
  staffId?: string,
): Promise<StaffAvailability[]> {
  const staffMembers = staffId
    ? await getStaffMemberById(businessId, staffId).then((member) =>
        member?.active ? [member] : [],
      )
    : (await listStaffMembers(businessId)).filter((member) => member.active);

  const rangeStart = toUtcInstant(date, "00:00", businessTimezone);
  const rangeEnd = toUtcInstant(date, "23:59", businessTimezone);
  const appointmentsThatDay = await listAppointments(businessId, rangeStart, rangeEnd);

  return staffMembers.map((member) => {
    const existingBookings: TimeRange[] = appointmentsThatDay
      .filter((appointment) => appointment.staffId === member.id)
      .map((appointment) => ({ startsAt: appointment.startsAt, endsAt: appointment.endsAt }));

    return {
      staffId: member.id,
      staffName: member.name,
      slots: findAvailableSlots(date, businessTimezone, serviceDurationMinutes, existingBookings),
    };
  });
}
