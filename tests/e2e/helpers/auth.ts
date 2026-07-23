import { createHash, randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { Client } from "pg";

/**
 * Mismo nombre de cookie y mismo algoritmo de hash que
 * `src/lib/session-cookie.ts` / `src/modules/auth/domain/session-token.ts` —
 * duplicados acá a propósito, igual que el resto de los specs E2E ya hablan
 * con la base por SQL crudo en vez de importar módulos internos de la app
 * (Playwright corre los specs con su propia resolución de TypeScript, sin el
 * alias `@/` configurado).
 */
const SESSION_COOKIE_NAME = "atlas_session";

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SeedRole = "OWNER" | "MANAGER" | "STAFF";

/**
 * Crea un usuario para el negocio dado y una sesión ya autenticada,
 * inyectando la cookie directo en el `BrowserContext` — así cada spec entra
 * derecho al Dashboard sin repetir el flujo de /login en cada test (ese
 * flujo en sí ya lo cubre `auth.spec.ts`).
 */
export async function loginAsUser(
  context: BrowserContext,
  baseURL: string,
  businessId: string,
  options: { email?: string; name?: string; role?: SeedRole } = {},
): Promise<void> {
  const suffix = randomBytes(6).toString("hex");
  const email = options.email ?? `e2e-${suffix}@example.com`;
  const name = options.name ?? "Usuario de prueba";
  const role = options.role ?? "OWNER";
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const userResult = await client.query(
      `INSERT INTO users (id, "businessId", email, "passwordHash", name, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'e2e-unused-hash', $4, $5, now(), now())
       RETURNING id`,
      [`e2e-user-${suffix}`, businessId, email, name, role],
    );
    const userId = userResult.rows[0].id as string;
    await client.query(
      `INSERT INTO sessions (id, "userId", "tokenHash", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, now())`,
      [`e2e-session-${suffix}`, userId, tokenHash, expiresAt],
    );
  } finally {
    await client.end();
  }

  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      domain: hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
