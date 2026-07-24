"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { ForbiddenError, requireRole } from "@/lib/session";
import {
  createStaffMember,
  deleteStaffMember,
  setStaffMemberActive,
  StaffMemberHasAppointmentsError,
  StaffMemberNotFoundError,
  updateStaffMember,
  type StaffMemberInput,
  type StaffMemberListItem,
} from "@/modules/catalog";

export type CreateStaffMemberActionResult =
  { success: true; staffMember: StaffMemberListItem } | { success: false; error: string };

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

  let staffMember: StaffMemberListItem;
  try {
    staffMember = await createStaffMember(business.id, input);
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: "Revisa los datos ingresados." };
    }
    logger.error(
      { error },
      "createStaffMemberAction: error inesperado guardando el miembro del equipo.",
    );
    return { success: false, error: "No se pudo guardar el miembro del equipo. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/staff");
  return { success: true, staffMember };
}

export type UpdateStaffMemberActionResult =
  { success: true; staffMember: StaffMemberListItem } | { success: false; error: string };

export async function updateStaffMemberAction(
  id: string,
  input: StaffMemberInput,
): Promise<UpdateStaffMemberActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  let staffMember: StaffMemberListItem;
  try {
    staffMember = await updateStaffMember(business.id, id, input);
  } catch (error) {
    if (error instanceof StaffMemberNotFoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisa los datos ingresados." };
    }
    logger.error(
      { error, staffMemberId: id },
      "updateStaffMemberAction: error inesperado actualizando el miembro del equipo.",
    );
    return {
      success: false,
      error: "No se pudo actualizar el miembro del equipo. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/staff");
  return { success: true, staffMember };
}

export type SetStaffMemberActiveActionResult =
  { success: true; staffMember: StaffMemberListItem } | { success: false; error: string };

/** Activa o desactiva un miembro del equipo — deja de ofrecerse para reservas nuevas, sin borrar su historial. */
export async function setStaffMemberActiveAction(
  id: string,
  active: boolean,
): Promise<SetStaffMemberActiveActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  let staffMember: StaffMemberListItem;
  try {
    staffMember = await setStaffMemberActive(business.id, id, active);
  } catch (error) {
    if (error instanceof StaffMemberNotFoundError) {
      return { success: false, error: error.message };
    }
    logger.error(
      { error, staffMemberId: id },
      "setStaffMemberActiveAction: error inesperado cambiando el estado del miembro del equipo.",
    );
    return { success: false, error: "No se pudo actualizar el estado. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/staff");
  return { success: true, staffMember };
}

export type DeleteStaffMemberActionResult = { success: true } | { success: false; error: string };

export async function deleteStaffMemberAction(id: string): Promise<DeleteStaffMemberActionResult> {
  let business;
  try {
    ({ business } = await requireRole(["OWNER", "MANAGER"]));
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: error.message };
    throw error;
  }

  try {
    await deleteStaffMember(business.id, id);
  } catch (error) {
    if (
      error instanceof StaffMemberNotFoundError ||
      error instanceof StaffMemberHasAppointmentsError
    ) {
      return { success: false, error: error.message };
    }
    logger.error(
      { error, staffMemberId: id },
      "deleteStaffMemberAction: error inesperado eliminando el miembro del equipo.",
    );
    return {
      success: false,
      error: "No se pudo eliminar el miembro del equipo. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/staff");
  return { success: true };
}
