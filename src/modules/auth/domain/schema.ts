import { z } from "zod";

// `.trim().toLowerCase()` tienen que ir ANTES de `.pipe(z.email())`, no
// encadenados después de `z.email()` — Zod valida el formato del email
// contra el string tal como llega, así que un `z.email().trim()` recibiría
// espacios en blanco (ej. de un autocompletado del navegador) y rechazaría
// un correo válido antes de llegar a limpiarlo.
const emailField = z.string().trim().toLowerCase().pipe(z.email("Ingresa un correo válido"));

export const loginInputSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

const credentialsShape = {
  email: emailField,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
};

/** La cuenta OWNER que se crea junto con un negocio nuevo — nunca otro rol, así que no recibe `role`. */
export const createOwnerAccountInputSchema = z.object(credentialsShape);
export type CreateOwnerAccountInput = z.infer<typeof createOwnerAccountInputSchema>;

/** Para altas futuras de usuarios con un rol elegido explícitamente (no usado todavía en Sprint 21 — sin UI propia). */
export const createUserInputSchema = z.object({
  ...credentialsShape,
  role: z.enum(["OWNER", "MANAGER", "STAFF"], { message: "Selecciona un rol" }),
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
