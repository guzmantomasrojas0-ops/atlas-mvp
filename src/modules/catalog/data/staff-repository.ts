import { db } from "@/lib/db";
import type { StaffMemberInput } from "../domain";

export function createStaffMember(businessId: string, input: StaffMemberInput) {
  return db.staffMember.create({
    data: {
      businessId,
      name: input.name,
      role: input.role,
    },
  });
}

export function listStaffMembersByBusiness(businessId: string) {
  return db.staffMember.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });
}

export function findStaffMemberById(businessId: string, id: string) {
  return db.staffMember.findFirst({ where: { id, businessId } });
}

/** `updateMany` (no `update`) porque scopea por `businessId` en la misma consulta — ver el mismo patrón en `cancelAppointmentById`. */
export function updateStaffMember(businessId: string, id: string, input: StaffMemberInput) {
  return db.staffMember.updateMany({
    where: { id, businessId },
    data: { name: input.name, role: input.role },
  });
}

export function setStaffMemberActive(businessId: string, id: string, active: boolean) {
  return db.staffMember.updateMany({
    where: { id, businessId },
    data: { active },
  });
}

export function countAppointmentsForStaffMember(businessId: string, id: string) {
  return db.appointment.count({ where: { businessId, staffId: id } });
}

export function deleteStaffMember(businessId: string, id: string) {
  return db.staffMember.deleteMany({ where: { id, businessId } });
}
