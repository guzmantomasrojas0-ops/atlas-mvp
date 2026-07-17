import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * Variables de entorno validadas. Falla rápido al iniciar la app si falta
 * o es inválida una variable requerida, en vez de fallar más tarde en un
 * punto arbitrario del código.
 */
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
