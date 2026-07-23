import { db } from "@/lib/db";
import type { ServiceInput } from "../domain";

export function createService(businessId: string, input: ServiceInput) {
  return db.service.create({
    data: {
      businessId,
      name: input.name,
      price: input.price,
      durationMinutes: input.durationMinutes,
    },
  });
}

export function listServicesByBusiness(businessId: string) {
  return db.service.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });
}

export function findServiceById(businessId: string, id: string) {
  return db.service.findFirst({ where: { id, businessId } });
}
