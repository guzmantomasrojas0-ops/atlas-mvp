import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import { Client } from "pg";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function resetAll() {
  // Orden respetando foreign keys — igual que el resto de los specs E2E.
  await withDb(async (client) => {
    await client.query('DELETE FROM sessions USING users WHERE sessions."userId" = users.id');
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM payments");
    await client.query("DELETE FROM messages");
    await client.query("DELETE FROM channel_mappings");
    await client.query("DELETE FROM conversations");
    await client.query("DELETE FROM appointment_notifications");
    await client.query("DELETE FROM appointments");
    await client.query("DELETE FROM clients");
    await client.query("DELETE FROM services");
    await client.query("DELETE FROM staff_members");
    await client.query("DELETE FROM businesses");
  });
}

const OWNER_EMAIL = "owner-e2e@example.com";
const OWNER_PASSWORD = "contraseña-de-prueba";

async function seedBusinessWithOwner() {
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('auth-e2e-business', 'Barbería Auth E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())`,
    );
    await client.query(
      `INSERT INTO users (id, "businessId", email, "passwordHash", name, role, "createdAt", "updatedAt")
       VALUES ('auth-e2e-owner', 'auth-e2e-business', $1, $2, 'Ana Gómez', 'OWNER', now(), now())`,
      [OWNER_EMAIL, passwordHash],
    );
  });
}

// .serial: todos los tests comparten el mismo negocio/usuario sembrado.
test.describe.serial("Autenticación", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedBusinessWithOwner();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("inicia sesión con credenciales correctas y entra al Dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Correo electrónico").fill(OWNER_EMAIL);
    await page.getByLabel("Contraseña").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Ana Gómez")).toBeVisible();
    await expect(page.getByText("Dueño")).toBeVisible();
  });

  test("rechaza una contraseña incorrecta y se queda en /login", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Correo electrónico").fill(OWNER_EMAIL);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("cerrar sesión vuelve a /login y bloquea el acceso al Dashboard de nuevo", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(OWNER_EMAIL);
    await page.getByLabel("Contraseña").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("visitar /login ya con una sesión activa redirige directo al Dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(OWNER_EMAIL);
    await page.getByLabel("Contraseña").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
