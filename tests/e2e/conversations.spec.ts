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
  // Orden respetando foreign keys.
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

async function seedConversation() {
  return withDb(async (client) => {
    const business = await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('conv-e2e-business', 'Barbería Conversaciones E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())
       RETURNING id`,
    );
    const businessId = business.rows[0].id as string;

    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('conv-e2e-client', $1, 'Juana Pérez', '+57 300 999 8888', now(), now())`,
      [businessId],
    );

    await client.query(
      `INSERT INTO conversations (id, "businessId", "clientId", channel, "createdAt", "updatedAt")
       VALUES ('conv-e2e-conversation', $1, 'conv-e2e-client', 'WHATSAPP', now(), now())`,
      [businessId],
    );

    await client.query(
      `INSERT INTO messages (id, "conversationId", sender, content, "createdAt")
       VALUES ('conv-e2e-message-1', 'conv-e2e-conversation', 'CLIENT', 'Hola, quería consultar por un turno', now())`,
    );

    return businessId;
  });
}

test.describe.serial("Conversations", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedConversation();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("muestra la conversación en la lista, con no-leído, y al abrirla se marca como leída", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "conv-e2e-business");
    await page.goto("/dashboard/conversations");

    await expect(page.getByText("Juana Pérez")).toBeVisible();
    await expect(page.getByText("Hola, quería consultar por un turno")).toBeVisible();
    await expect(page.getByLabel("No leído")).toBeVisible();

    await page.getByText("Juana Pérez").click();

    await expect(page).toHaveURL("/dashboard/conversations/conv-e2e-conversation");
    await expect(page.getByText("Hola, quería consultar por un turno").first()).toBeVisible();

    // Al abrirla se dispara "marcar como leída" — recargando, ya no debería
    // quedar el indicador de no-leído.
    await page.reload();
    await expect(page.getByLabel("No leído")).not.toBeVisible();
  });

  test("envía un mensaje desde el composer y aparece en el hilo", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "conv-e2e-business");
    await page.goto("/dashboard/conversations/conv-e2e-conversation");

    await page.getByLabel("Escribir un mensaje").fill("¡Claro! ¿Qué día te viene bien?");
    await page.getByLabel("Enviar mensaje").click();

    await expect(page.getByText("¡Claro! ¿Qué día te viene bien?")).toBeVisible();
  });

  test("estado vacío cuando no hay ninguna conversación seleccionada", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "conv-e2e-business");
    await page.goto("/dashboard/conversations");
    await expect(page.getByText("Selecciona una conversación")).toBeVisible();
  });

  test("estado vacío cuando el negocio no tiene conversaciones todavía", async ({
    page,
    context,
    baseURL,
  }) => {
    await withDb((client) => client.query("DELETE FROM messages"));
    await withDb((client) => client.query("DELETE FROM conversations"));
    await loginAsUser(context, baseURL!, "conv-e2e-business");
    await page.goto("/dashboard/conversations");
    await expect(page.getByText("Todavía no tienes conversaciones")).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await resetAll();
    await page.goto("/dashboard/conversations");
    await expect(page).toHaveURL("/login");
  });
});
