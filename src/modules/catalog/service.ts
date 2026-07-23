import {
  serviceInputSchema,
  staffMemberInputSchema,
  type ServiceInput,
  type StaffMemberInput,
} from "./domain";
import {
  createService as createServiceRecord,
  createStaffMember as createStaffMemberRecord,
  findServiceById,
  findStaffMemberById,
  listServicesByBusiness,
  listStaffMembersByBusiness,
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
export async function createStaffMember(businessId: string, input: StaffMemberInput) {
  const data = staffMemberInputSchema.parse(input);
  return createStaffMemberRecord(businessId, data);
}

/** Lista los miembros del equipo de un negocio. */
export async function listStaffMembers(businessId: string): Promise<StaffMemberListItem[]> {
  const staffMembers = await listStaffMembersByBusiness(businessId);
  return staffMembers.map((staffMember) => ({
    id: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
  }));
}

/** Busca un miembro del equipo puntual, acotado al negocio. */
export async function getStaffMemberById(
  businessId: string,
  id: string,
): Promise<StaffMemberListItem | null> {
  const staffMember = await findStaffMemberById(businessId, id);
  if (!staffMember) return null;
  return { id: staffMember.id, name: staffMember.name, role: staffMember.role };
}
