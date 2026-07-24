import {
  serviceInputSchema,
  StaffMemberHasAppointmentsError,
  staffMemberInputSchema,
  StaffMemberNotFoundError,
  type ServiceInput,
  type StaffMemberInput,
} from "./domain";
import {
  countAppointmentsForStaffMember,
  createService as createServiceRecord,
  createStaffMember as createStaffMemberRecord,
  deleteStaffMember as deleteStaffMemberRecord,
  findServiceById,
  findStaffMemberById,
  listServicesByBusiness,
  listStaffMembersByBusiness,
  setStaffMemberActive as setStaffMemberActiveRecord,
  updateStaffMember as updateStaffMemberRecord,
} from "./data";

export interface ServiceListItem {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface StaffMemberListItem {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

/**
 * Crea un servicio para un negocio. Valida con Zod acá — es el punto de
 * entrada real del módulo, no confía en que quien llame ya lo haya hecho.
 */
export async function createService(businessId: string, input: ServiceInput) {
  const data = serviceInputSchema.parse(input);
  return createServiceRecord(businessId, data);
}

/**
 * Lista los servicios de un negocio. Convierte `price` (Prisma Decimal) a
 * `number` acá — un Decimal no es serializable de forma segura al cruzar
 * de un Server Component a un Client Component.
 */
export async function listServices(businessId: string): Promise<ServiceListItem[]> {
  const services = await listServicesByBusiness(businessId);
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    price: service.price.toNumber(),
    durationMinutes: service.durationMinutes,
  }));
}

/** Busca un servicio puntual, acotado al negocio (evita fugas entre tenants). */
export async function getServiceById(
  businessId: string,
  id: string,
): Promise<ServiceListItem | null> {
  const service = await findServiceById(businessId, id);
  if (!service) return null;
  return {
    id: service.id,
    name: service.name,
    price: service.price.toNumber(),
    durationMinutes: service.durationMinutes,
  };
}

/**
 * Crea un miembro del equipo para un negocio. Valida con Zod acá — es el
 * punto de entrada real del módulo, no confía en que quien llame ya lo haya
 * hecho.
 */
export async function createStaffMember(
  businessId: string,
  input: StaffMemberInput,
): Promise<StaffMemberListItem> {
  const data = staffMemberInputSchema.parse(input);
  const staffMember = await createStaffMemberRecord(businessId, data);
  return {
    id: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
    active: staffMember.active,
  };
}

/** Lista los miembros del equipo de un negocio (activos e inactivos — la gestión del equipo necesita ver ambos). */
export async function listStaffMembers(businessId: string): Promise<StaffMemberListItem[]> {
  const staffMembers = await listStaffMembersByBusiness(businessId);
  return staffMembers.map((staffMember) => ({
    id: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
    active: staffMember.active,
  }));
}

/** Busca un miembro del equipo puntual, acotado al negocio. */
export async function getStaffMemberById(
  businessId: string,
  id: string,
): Promise<StaffMemberListItem | null> {
  const staffMember = await findStaffMemberById(businessId, id);
  if (!staffMember) return null;
  return {
    id: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
    active: staffMember.active,
  };
}

/**
 * Actualiza nombre/rol de un miembro del equipo existente. Reutiliza el
 * mismo Zod de creación — misma forma de datos, misma validación.
 */
export async function updateStaffMember(
  businessId: string,
  id: string,
  input: StaffMemberInput,
): Promise<StaffMemberListItem> {
  const data = staffMemberInputSchema.parse(input);
  const { count } = await updateStaffMemberRecord(businessId, id, data);
  if (count === 0) throw new StaffMemberNotFoundError();

  const updated = await getStaffMemberById(businessId, id);
  if (!updated) throw new StaffMemberNotFoundError();
  return updated;
}

/**
 * Activa o desactiva un miembro del equipo — un miembro inactivo deja de
 * ofrecerse para reservas nuevas (Dashboard y agente de IA) pero conserva su
 * historial de citas.
 */
export async function setStaffMemberActive(
  businessId: string,
  id: string,
  active: boolean,
): Promise<StaffMemberListItem> {
  const { count } = await setStaffMemberActiveRecord(businessId, id, active);
  if (count === 0) throw new StaffMemberNotFoundError();

  const updated = await getStaffMemberById(businessId, id);
  if (!updated) throw new StaffMemberNotFoundError();
  return updated;
}

/**
 * Borra un miembro del equipo permanentemente. Solo posible si nunca tuvo
 * ninguna cita asociada — con historial, `Appointment.staffId` es RESTRICT
 * (ver PLAN.md) y borrar rompería ese historial; se rechaza acá mismo con un
 * error claro en vez de dejar que la FK de Postgres tire un error genérico.
 */
export async function deleteStaffMember(businessId: string, id: string): Promise<void> {
  const appointmentCount = await countAppointmentsForStaffMember(businessId, id);
  if (appointmentCount > 0) throw new StaffMemberHasAppointmentsError();

  const { count } = await deleteStaffMemberRecord(businessId, id);
  if (count === 0) throw new StaffMemberNotFoundError();
}
