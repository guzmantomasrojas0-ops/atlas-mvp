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
