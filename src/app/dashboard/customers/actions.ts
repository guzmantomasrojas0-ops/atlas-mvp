"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { requireSession } from "@/lib/session";
import {
  CustomerNotFoundError,
  updateCustomer,
  type CustomerInput,
  type CustomerListItem,
} from "@/modules/customer";

export type UpdateCustomerActionResult =
  { success: true; customer: CustomerListItem } | { success: false; error: string };

/**
 * Cualquier usuario autenticado puede editar los datos de contacto de un
 * cliente (no es un dato sensible del negocio como pagos o catálogo) —
 * `requireSession`, no `requireRole`.
 */
export async function updateCustomerAction(
  id: string,
  input: CustomerInput,
): Promise<UpdateCustomerActionResult> {
  const { business } = await requireSession();

  let customer: CustomerListItem;
  try {
    customer = await updateCustomer(business.id, id, input);
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisa los datos ingresados." };
    }
    logger.error(
      { error, customerId: id },
      "updateCustomerAction: error inesperado actualizando el cliente.",
    );
    return { success: false, error: "No se pudo actualizar el cliente. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return { success: true, customer };
}
