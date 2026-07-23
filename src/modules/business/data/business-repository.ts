import { db } from "@/lib/db";
import type { BusinessInput } from "../domain";

export function createBusiness(input: BusinessInput) {
  return db.business.create({ data: input });
}

export function findFirstBusiness() {
  return db.business.findFirst({ orderBy: { createdAt: "asc" } });
}
