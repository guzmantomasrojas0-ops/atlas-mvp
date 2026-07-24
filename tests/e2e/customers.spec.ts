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

async function seedCustomerFixtures() {
  const startsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('cust-e2e-business', 'Barbería Clientes E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())`,
    );
    await client.query(
      `INSERT INTO services (id, "businessId", name, price, "durationMinutes", "createdAt", "updatedAt")
       VALUES ('cust-e2e-service', 'cust-e2e-business', 'Corte de pelo', 25000, 30, now(), now())`,
    );
    await client.query(
      `INSERT INTO staff_members (id, "businessId", name, role, "createdAt", "updatedAt")
       VALUES ('cust-e2e-staff', 'cust-e2e-business', 'Ana Gómez', 'Barbera', now(), now())`,
    );
    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('cust-e2e-client', 'cust-e2e-business', 'Juana Pérez', '+57 300 999 8888', now(), now())`,
    );
    await client.query(
      `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "paymentStatus", "createdAt", "updatedAt")
       VALUES ('cust-e2e-appointment', 'cust-e2e-business', 'cust-e2e-staff', 'cust-e2e-service', 'cust-e2e-client', $1, $2, 'CONFIRMED', 'PAID', now(), now())`,
      [startsAt, endsAt],
    );
    await client.query(
      `INSERT INTO payments (id, "businessId", "appointmentId", amount, currency, method, status, "confirmedBy", "createdAt", "confirmedAt")
       VALUES ('cust-e2e-payment', 'cust-e2e-business', 'cust-e2e-appointment', 25000, 'USD', 'ZELLE', 'CONFIRMED', 'Ana', now(), now())`,
    );
    await client.query(
      `INSERT INTO conversations (id, "businessId", "clientId", channel, "createdAt", "updatedAt")
       VALUES ('cust-e2e-conversation', 'cust-e2e-business', 'cust-e2e-client', 'WHATSAPP', now(), now())`,
    );
    await client.query(
      `INSERT INTO messages (id, "conversationId", sender, content, "createdAt")
       VALUES ('cust-e2e-message', 'cust-e2e-conversation', 'CLIENT', 'Hola, quería consultar por un turno', now())`,
    );
  });
}

// .serial: todos los tests comparten el mismo negocio sembrado — correrlos en paralelo los haría pisarse.
test.describe.serial("Customer detail", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedCustomerFixtures();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("abre el detalle de un cliente desde la tabla y ve su historial completo", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "cust-e2e-business");
    await page.goto("/dashboard/customers");

    await page.getByRole("link", { name: /Juana Pérez/ }).click();
    await expect(page).toHaveURL("/dashboard/customers/cust-e2e-client");

    await expect(page.getByRole("heading", { name: "Juana Pérez" })).toBeVisible();

    // Historial de reservas.
    await expect(page.getByText("Corte de pelo", { exact: true })).toBeVisible();
    await expect(page.getByText("Pagado")).toBeVisible();

    // Historial de pagos.
    await expect(page.getByText(/25\.000,00/)).toBeVisible();
    await expect(page.getByText("Zelle")).toBeVisible();

    // Conversaciones relacionadas.
    await expect(page.getByText("Hola, quería consultar por un turno")).toBeVisible();
  });

  test("edita nombre y teléfono del cliente desde su ficha", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, "cust-e2e-business");
    await page.goto("/dashboard/customers/cust-e2e-client");

    await page.getByLabel("Nombre").fill("Juana Pérez Editada");
    await page.getByLabel("Teléfono").fill("+57 301 222 3333");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Guardado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Juana Pérez Editada" })).toBeVisible();

    // Persiste tras recargar y se refleja también en la tabla de Clientes.
    await page.goto("/dashboard/customers");
    await expect(page.getByText("Juana Pérez Editada")).toBeVisible();
    await expect(page.getByText("+57 301 222 3333")).toBeVisible();
  });

  test("redirige a /dashboard/customers si el cliente no existe", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "cust-e2e-business");
    await page.goto("/dashboard/customers/no-existe");

    await expect(page).toHaveURL("/dashboard/customers");
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await page.goto("/dashboard/customers/cust-e2e-client");
    await expect(page).toHaveURL("/login");
  });
});
