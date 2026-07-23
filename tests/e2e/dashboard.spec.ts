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

async function seedDashboardFixtures() {
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('dash-e2e-business', 'Barbería Dashboard E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())`,
    );
    await client.query(
      `INSERT INTO services (id, "businessId", name, price, "durationMinutes", "createdAt", "updatedAt")
       VALUES ('dash-e2e-service', 'dash-e2e-business', 'Corte de pelo', 25000, 30, now(), now())`,
    );
    await client.query(
      `INSERT INTO staff_members (id, "businessId", name, role, "createdAt", "updatedAt")
       VALUES ('dash-e2e-staff', 'dash-e2e-business', 'Ana Gómez', 'Barbera', now(), now())`,
    );
    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('dash-e2e-client', 'dash-e2e-business', 'Juana Pérez', '+57 300 999 8888', now(), now())`,
    );
    await client.query(
      `INSERT INTO conversations (id, "businessId", "clientId", channel, "createdAt", "updatedAt")
       VALUES ('dash-e2e-conversation', 'dash-e2e-business', 'dash-e2e-client', 'WHATSAPP', now(), now())`,
    );
    await client.query(
      `INSERT INTO messages (id, "conversationId", sender, content, "createdAt")
       VALUES ('dash-e2e-message-1', 'dash-e2e-conversation', 'CLIENT', 'Hola, quería consultar por un turno', now())`,
    );
    // Una reserva a futuro, dentro del rango de la semana que muestra el calendario.
    await client.query(
      `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "createdAt", "updatedAt")
       VALUES ('dash-e2e-appointment', 'dash-e2e-business', 'dash-e2e-staff', 'dash-e2e-service', 'dash-e2e-client', now() + interval '1 hour', now() + interval '1 hour 30 minutes', 'CONFIRMED', now(), now())`,
    );
  });
}

// .serial: todos los tests comparten el mismo negocio sembrado — correrlos en paralelo los haría pisarse.
test.describe.serial("Dashboard", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedDashboardFixtures();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("el resumen del Dashboard muestra las métricas y la actividad reciente", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "dash-e2e-business");
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Conversaciones activas")).toBeVisible();
    await expect(page.getByText("Clientes totales")).toBeVisible();

    // Preview de conversaciones recientes con el cliente sembrado.
    await expect(page.getByText("Juana Pérez").first()).toBeVisible();
  });

  test("navega desde el Dashboard hasta abrir una conversación", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "dash-e2e-business");
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Conversaciones" }).click();
    await expect(page).toHaveURL("/dashboard/conversations");
    // Espera a que la lista de conversaciones haya montado de verdad (no
    // solo a que cambie la URL) — si no, un click inmediato puede todavía
    // encontrar el preview de "Juana Pérez" del Dashboard conviviendo en el
    // DOM durante la transición de la navegación cliente-side.
    await expect(page.getByPlaceholder("Buscar conversaciones…")).toBeVisible();

    await page.getByRole("link", { name: /Juana Pérez/ }).click();
    await expect(page).toHaveURL("/dashboard/conversations/dash-e2e-conversation");
    await expect(page.getByText("Hola, quería consultar por un turno").first()).toBeVisible();
  });

  test("ve las citas del negocio en el calendario", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, "dash-e2e-business");
    await page.goto("/dashboard/appointments");

    await expect(page.getByRole("heading", { name: "Reservas" })).toBeVisible();
    await expect(page.getByText("Corte de pelo").first()).toBeVisible();
  });

  test("ve los clientes del negocio en la tabla de Clientes", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "dash-e2e-business");
    await page.goto("/dashboard/customers");

    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    await expect(page.getByText("Juana Pérez")).toBeVisible();
    await expect(page.getByText("+57 300 999 8888")).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await resetAll();
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
