"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { setSessionCookie } from "@/lib/session";
import {
  InvalidCredentialsError,
  login,
  TooManyLoginAttemptsError,
  type LoginInput,
} from "@/modules/auth";

export type LoginActionResult = { success: false; error: string };

export async function loginAction(input: LoginInput): Promise<LoginActionResult> {
  try {
    const result = await login(input);
    await setSessionCookie(result.token);
  } catch (error) {
    if (error instanceof InvalidCredentialsError || error instanceof TooManyLoginAttemptsError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { success: false, error: "Revisá los datos ingresados." };
    }
    logger.error({ error }, "loginAction: error inesperado iniciando sesión.");
    return { success: false, error: "No se pudo iniciar sesión. Intentá de nuevo." };
  }

  redirect("/dashboard");
}
