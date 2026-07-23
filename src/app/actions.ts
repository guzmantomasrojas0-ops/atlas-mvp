"use server";

import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { logger } from "@/lib/logger";
import { setSessionCookie } from "@/lib/session";
import {
  createOwnerAccountInputSchema,
  EmailAlreadyInUseError,
  createOwnerAccount,
  login,
} from "@/modules/auth";
import { createBusiness } from "@/modules/business";
import { businessInputSchema } from "@/modules/business/domain";

/**
 * El bootstrap de un negocio nuevo crea el Business Y su primera cuenta
 * (OWNER) en un solo paso — sin esto, una vez que existe autenticación,
 * "crear un negocio" dejaría a nadie con forma de iniciar sesión en él. Un
 * onboarding self-service más elaborado es Sprint 25; esto es el mínimo para
 * que el flujo existente siga siendo funcional bajo el nuevo requisito.
 */
const setupInputSchema = z.object({
  business: businessInputSchema,
  owner: createOwnerAccountInputSchema,
});

export type SetupInput = z.infer<typeof setupInputSchema>;
export type CreateBusinessActionResult = { success: false; error: string };

export async function createBusinessAction(input: SetupInput): Promise<CreateBusinessActionResult> {
  let token: string;
  try {
    const data = setupInputSchema.parse(input);
    const business = await createBusiness(data.business);
    await createOwnerAccount(business.id, data.owner);
    const result = await login({ email: data.owner.email, password: data.owner.password });
    token = result.token;
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá los datos ingresados." };
    }
    logger.error({ error }, "createBusinessAction: error inesperado creando el negocio.");
    return { success: false, error: "No se pudo guardar el negocio. Intentá de nuevo." };
  }

  await setSessionCookie(token);
  redirect("/dashboard");
}
