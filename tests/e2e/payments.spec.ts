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

async function seedAppointment() {
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('pay-e2e-business', 'Barbería Pagos E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())`,
    );
    await client.query(
      `INSERT INTO services (id, "businessId", name, price, "durationMinutes", "createdAt", "updatedAt")
       VALUES ('pay-e2e-service', 'pay-e2e-business', 'Corte de pelo', 25000, 30, now(), now())`,
    );
    await client.query(
      `INSERT INTO staff_members (id, "businessId", name, role, "createdAt", "updatedAt")
       VALUES ('pay-e2e-staff', 'pay-e2e-business', 'Ana Gómez', 'Barbera', now(), now())`,
    );
    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('pay-e2e-client', 'pay-e2e-business', 'Juana Pérez', '+57 300 999 8888', now(), now())`,
    );
    await client.query(
      `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "createdAt", "updatedAt")
       VALUES ('pay-e2e-appointment', 'pay-e2e-business', 'pay-e2e-staff', 'pay-e2e-service', 'pay-e2e-client', now() + interval '1 hour', now() + interval '1 hour 30 minutes', 'CONFIRMED', now(), now())`,
    );
  });
}

// .serial: todos los tests comparten el mismo negocio sembrado — correrlos en paralelo los haría pisarse.
test.describe.serial("Payments", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedAppointment();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("confirmar un pago desde el detalle de la reserva, verlo en /dashboard/payments, revertirlo, y que persista tras refrescar", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "pay-e2e-business");
    await page.goto("/dashboard/appointments");

    // Abrir el detalle de la única reserva sembrada.
    await page.getByRole("button", { name: /Juana Pérez/ }).click();
    await expect(page.getByText("Pago pendiente")).toBeVisible();

    // Confirmar el pago.
    await page.getByRole("button", { name: "Confirmar pago" }).first().click();
    await page.getByLabel("Monto (USD)").fill("25000");
    await page.getByLabel("Confirmado por").fill("Ana Gómez");
    await page.getByRole("button", { name: "Confirmar pago" }).click();

    await expect(page.getByText("Pago confirmado")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Marcar como pendiente" })).toBeVisible();

    // Aparece en la lista de pagos del Dashboard.
    await page.goto("/dashboard/payments");
    await expect(page.getByText("Juana Pérez")).toBeVisible();
    await expect(page.getByText("Corte de pelo")).toBeVisible();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

    // Volver al detalle y marcar como pendiente.
    await page.goto("/dashboard/appointments");
    await page.getByRole("button", { name: /Juana Pérez/ }).click();
    await expect(page.getByText("Pago confirmado")).toBeVisible();
    await page.getByRole("button", { name: "Marcar como pendiente" }).click();
    // Revertir dispara una acción de servidor y después un router.refresh()
    // — dos round-trips en serie antes de que la UI se actualice, así que
    // le damos más margen que al timeout por defecto de 5s.
    await expect(page.getByText("Pago pendiente")).toBeVisible({ timeout: 10_000 });

    // La persistencia es correcta: sigue pendiente después de refrescar.
    await page.reload();
    await page.getByRole("button", { name: /Juana Pérez/ }).click();
    await expect(page.getByText("Pago pendiente")).toBeVisible();

    // Y el historial revertido sigue visible en /dashboard/payments (nunca se borra).
    await page.goto("/dashboard/payments");
    await expect(page.getByText("Revertido", { exact: true })).toBeVisible();
  });

  test("no permite confirmar el pago de una cita cancelada", async ({ page, context, baseURL }) => {
    await withDb((client) =>
      client.query("UPDATE appointments SET status = 'CANCELLED' WHERE id = 'pay-e2e-appointment'"),
    );

    // Una cita cancelada ya no aparece en la grilla (listAppointments solo trae CONFIRMED),
    // así que no hay forma de llegar a "Confirmar pago" desde la UI — se verifica
    // acá que directamente no aparece nada para seleccionar.
    await loginAsUser(context, baseURL!, "pay-e2e-business");
    await page.goto("/dashboard/appointments");
    await expect(page.getByRole("button", { name: /Juana Pérez/ })).toHaveCount(0);
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await resetAll();
    await page.goto("/dashboard/payments");
    await expect(page).toHaveURL("/login");
  });
});
