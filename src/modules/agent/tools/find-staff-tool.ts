import { z } from "zod";
import { listStaffMembers } from "@/modules/catalog";
import { matchesQuery, type Tool } from "../domain";

export const findStaffInputSchema = z.object({
  businessId: z.string().min(1),
  /** Búsqueda parcial por nombre, sin distinguir mayúsculas ni tildes. Si se omite, devuelve todos. */
  query: z.string().min(1).optional(),
});

export type FindStaffInput = z.infer<typeof findStaffInputSchema>;

export interface StaffMatch {
  id: string;
  name: string;
  role: string;
}

export interface FindStaffOutput {
  staff: StaffMatch[];
}

/** Filtra staff por nombre. Pura — separada de `execute` para poder testearla sin tocar la base. */
export function filterStaffByQuery(staff: StaffMatch[], query?: string): StaffMatch[] {
  if (!query) return staff;
  return staff.filter((member) => matchesQuery(member.name, query));
}

/**
 * Busca miembros del equipo por nombre. Todo el equipo cargado se devuelve
 * como activo — el esquema todavía no distingue staff activo/inactivo.
 */
export const findStaffTool: Tool<FindStaffInput, FindStaffOutput> = {
  name: "FIND_STAFF",
  description: "Busca miembros del equipo por nombre (búsqueda parcial).",
  inputSchema: findStaffInputSchema,
  async execute(input) {
    const allStaff = await listStaffMembers(input.businessId);
    return { staff: filterStaffByQuery(allStaff, input.query) };
  },
};
