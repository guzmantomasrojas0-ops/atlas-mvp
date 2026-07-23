"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { ForbiddenError, requireRole } from "@/lib/session";
import { createStaffMember, type StaffMemberInput } from "@/modules/catalog";

export type CreateStaffMemberActionResult = { success: true } | { success: false; error: string };

/** Solo Owner/Manager pueden gestionar el catálogo de equipo — `canManageCatalog` en modules/auth. */
export async function createStaffMemberAction(
  input: StaffMemberInput,
): Promise<CreateStaffMemberActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  try {
    await createStaffMember(business.id, input);
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá los datos ingresados." };
    }
    logger.error(
      { error },
      "createStaffMemberAction: error inesperado guardando el miembro del equipo.",
    );
    return { success: false, error: "No se pudo guardar el miembro del equipo. Intentá de nuevo." };
  }

  revalidatePath("/dashboard/staff");
  return { success: true };
}
