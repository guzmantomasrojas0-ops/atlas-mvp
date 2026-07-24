"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { ForbiddenError, requireRole } from "@/lib/session";
import { createService, type ServiceInput } from "@/modules/catalog";

export type CreateServiceActionResult = { success: true } | { success: false; error: string };

/** Solo Owner/Manager pueden gestionar el catálogo de servicios — `canManageCatalog` en modules/auth. */
export async function createServiceAction(input: ServiceInput): Promise<CreateServiceActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  try {
    await createService(business.id, input);
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: "Revisa los datos ingresados." };
    }
    logger.error({ error }, "createServiceAction: error inesperado guardando el servicio.");
    return { success: false, error: "No se pudo guardar el servicio. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/services");
  return { success: true };
}
