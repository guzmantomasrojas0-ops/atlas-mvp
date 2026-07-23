import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { loginAsUser } from "./helpers/auth";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function resetBusinesses() {
  // Toda la cadena que cuelga de businesses sin ON DELETE CASCADE — hay que
  // borrar primero los dependientes (en orden) o el DELETE viola la foreign
  // key. appointments/clients existen desde el módulo scheduling.
  await withDb(async (client) => {
    await client.query('DELETE FROM sessions USING users WHERE sessions."userId" = users.id');
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM payments");
    await client.query("DELETE FROM messages");
    await client.query("DELETE FROM conversations");
    await client.query("DELETE FROM appointments");
    await client.query("DELETE FROM clients");
    await client.query("DELETE FROM services");
    await client.query("DELETE FROM staff_members");
    await client.query("DELETE FROM businesses");
  });
}

async function createTestBusiness() {
  return withDb(async (client) => {
    const result = await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, 'Barbería Services E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())
       RETURNING id`,
    );
    return result.rows[0].id as string;
  });
}

// .serial: todos los tests de este archivo comparten el mismo negocio y la
// misma tabla de servicios — correrlos en paralelo los haría pisarse.
test.describe.serial("Services", () => {
  let businessId: string;

  test.beforeEach(async () => {
    await resetBusinesses();
    businessId = await createTestBusiness();
  });

  test.afterEach(async () => {
    await resetBusinesses();
  });

  test("agrega un servicio y lo muestra en la lista", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, businessId);
    await page.goto("/dashboard/services");

    await expect(page.getByText("Todavía no tenés servicios")).toBeVisible();

    await page.getByLabel("Nombre del servicio").fill("Corte de pelo");
    await page.getByLabel("Precio").fill("25000");
    await page.getByLabel("Duración (minutos)").fill("45");
    await page.getByRole("button", { name: "Agregar servicio" }).click();

    await expect(page.getByText("1 servicio")).toBeVisible();
    await expect(page.getByText("Corte de pelo")).toBeVisible();
    await expect(page.getByText("45 min")).toBeVisible();
    await expect(page.getByText("$25.000")).toBeVisible();
  });

  test("muestra errores de validación con campos vacíos", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, businessId);
    await page.goto("/dashboard/services");

    await page.getByRole("button", { name: "Agregar servicio" }).click();

    await expect(page.getByText("El nombre debe tener al menos 2 caracteres")).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await page.goto("/dashboard/services");
    await expect(page).toHaveURL("/login");
  });
});
