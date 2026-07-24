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
       VALUES (gen_random_uuid()::text, 'Barbería Staff E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())
       RETURNING id`,
    );
    return result.rows[0].id as string;
  });
}

// .serial: todos los tests de este archivo comparten el mismo negocio y la
// misma tabla de staff — correrlos en paralelo los haría pisarse.
test.describe.serial("Staff", () => {
  let businessId: string;

  test.beforeEach(async () => {
    await resetBusinesses();
    businessId = await createTestBusiness();
  });

  test.afterEach(async () => {
    await resetBusinesses();
  });

  test("agrega un miembro del equipo y lo muestra en la lista", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, businessId);
    await page.goto("/dashboard/staff");

    await expect(page.getByText("Todavía no tienes equipo")).toBeVisible();

    await page.getByLabel("Nombre").fill("Juan Pérez");
    await page.getByLabel("Rol").fill("Barbero");
    await page.getByRole("button", { name: "Agregar al equipo" }).click();

    await expect(page.getByText("1 persona")).toBeVisible();
    await expect(page.getByText("Juan Pérez")).toBeVisible();
    await expect(page.getByText("Barbero")).toBeVisible();
  });

  test("edita, desactiva, reactiva y elimina un miembro del equipo", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, businessId);
    await page.goto("/dashboard/staff");

    await page.getByLabel("Nombre").fill("Juan Pérez");
    await page.getByLabel("Rol").fill("Barbero");
    await page.getByRole("button", { name: "Agregar al equipo" }).click();
    await expect(page.getByText("1 persona")).toBeVisible();

    // Seleccionar el miembro abre el panel de edición.
    await page.getByRole("button", { name: /Juan Pérez/ }).click();
    await expect(page.getByRole("heading", { name: "Editar miembro" })).toBeVisible();

    // Editar nombre y rol.
    await page.getByLabel("Nombre").fill("Juan Pérez Editado");
    await page.getByLabel("Rol").fill("Barbero senior");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Juan Pérez Editado", { exact: true })).toBeVisible();
    await expect(page.getByText("Barbero senior", { exact: true })).toBeVisible();

    // Desactivar — se muestra como inactivo (badge en la lista y en el panel), y reactivar lo revierte.
    await page.getByRole("button", { name: "Desactivar" }).click();
    await expect(page.getByText("Inactivo").first()).toBeVisible();
    await page.getByRole("button", { name: "Reactivar" }).click();
    await expect(page.getByText("Inactivo")).toHaveCount(0);

    // Eliminar (con confirmación) — no tiene citas, así que se borra de verdad.
    await page.getByRole("button", { name: "Eliminar miembro" }).click();
    await page.getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText("Todavía no tienes equipo")).toBeVisible();
  });

  test("muestra errores de validación con campos vacíos", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, businessId);
    await page.goto("/dashboard/staff");

    await page.getByRole("button", { name: "Agregar al equipo" }).click();

    await expect(page.getByText("El nombre debe tener al menos 2 caracteres")).toBeVisible();
    await expect(page.getByText("El rol debe tener al menos 2 caracteres")).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await page.goto("/dashboard/staff");
    await expect(page).toHaveURL("/login");
  });
});
