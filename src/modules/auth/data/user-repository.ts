import { db } from "@/lib/db";
import type { Role } from "../domain";

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
}

export function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}

/** Nunca recibe la contraseña en texto plano — `service.ts` la hashea antes de llegar acá. */
export function createUser(businessId: string, input: CreateUserRecord) {
  return db.user.create({ data: { businessId, ...input } });
}
