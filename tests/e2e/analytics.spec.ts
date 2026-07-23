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

async function resetAll() {
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

async function seedFixtures() {
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('ana-e2e-business', 'Barbería Analytics E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())`,
    );
    await client.query(
      `INSERT INTO services (id, "businessId", name, price, "durationMinutes", "createdAt", "updatedAt")
       VALUES ('ana-e2e-service', 'ana-e2e-business', 'Corte de pelo', 25000, 30, now(), now())`,
    );
    await client.query(
      `INSERT INTO staff_members (id, "businessId", name, role, "createdAt", "updatedAt")
       VALUES ('ana-e2e-staff', 'ana-e2e-business', 'Ana Gómez', 'Barbera', now(), now())`,
    );
    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('ana-e2e-client', 'ana-e2e-business', 'Juana Pérez', '+57 300 999 8888', now(), now())`,
    );
    await client.query(
      `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "paymentStatus", "createdAt", "updatedAt")
       VALUES ('ana-e2e-appointment', 'ana-e2e-business', 'ana-e2e-staff', 'ana-e2e-service', 'ana-e2e-client', now() + interval '1 hour', now() + interval '1 hour 30 minutes', 'CONFIRMED', 'PENDING', now(), now())`,
    );
  });
}

test.describe.serial("Analytics", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedFixtures();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("muestra el panel de métricas y cambia de período", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, "ana-e2e-business");
    await page.goto("/dashboard/analytics");

    // El panel renderiza sus tarjetas de métricas (esto también protege contra
    // que un componente cliente arrastre el módulo de datos al bundle del
    // navegador — si eso pasara, la página daría 500 y esto fallaría). Se
    // busca dentro de <main> — "Reservas" también existe como link de la
    // sidebar, y sin acotar matchea ambos.
    const main = page.getByRole("main");
    await expect(main.getByText("Ingresos", { exact: true })).toBeVisible();
    await expect(main.getByText("Reservas", { exact: true })).toBeVisible();
    await expect(main.getByText("Clientes nuevos")).toBeVisible();
    await expect(main.getByText("Tasa de cancelación")).toBeVisible();

    // Cambiar de período navega y mantiene el panel visible.
    await page.getByRole("button", { name: "Últimos 7 días" }).click();
    await expect(page).toHaveURL(/period=7d/);
    await expect(main.getByText("Ingresos", { exact: true })).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await resetAll();
    await page.goto("/dashboard/analytics");
    await expect(page).toHaveURL("/login");
  });
});
