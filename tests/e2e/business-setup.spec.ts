import { expect, test } from "@playwright/test";
import { Client } from "pg";

const TEST_BUSINESS_NAME = "Barbería E2E Test";

// La página raíz muestra el formulario solo si no hay ningún negocio
// todavía (ver Sprint 1: "crear el primer negocio"), así que cada test
// necesita partir de una base sin negocios — no solo sin el suyo propio.
async function resetBusinesses() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Toda la cadena que cuelga de businesses sin ON DELETE CASCADE — hay
    // que borrar primero los dependientes (en orden) o el DELETE viola la
    // foreign key. appointments/clients existen desde el módulo scheduling.
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
  } finally {
    await client.end();
  }
}

// .serial: ambos tests comparten el mismo estado global ("¿ya existe un
// negocio?"), así que no pueden correr en paralelo entre sí sin pisarse.
test.describe.serial("Business Setup", () => {
  test.beforeEach(async () => {
    await resetBusinesses();
  });

  test.afterEach(async () => {
    await resetBusinesses();
  });

  test("crea el primer negocio (y su cuenta Owner) desde el formulario, y entra directo al Dashboard", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Configura tu negocio" })).toBeVisible();
    await expect(page.getByText("0 de 8 completados")).toBeVisible();

    await page.getByLabel("Nombre del negocio").fill(TEST_BUSINESS_NAME);
    await expect(page.getByText("1 de 8 completados")).toBeVisible();

    await page.getByLabel("Teléfono").fill("+57 300 999 8888");
    await page.getByLabel("Dirección").fill("Carrera 7 #10-20");

    await page.getByLabel("Zona horaria").click();
    await page.getByPlaceholder("Buscar zona horaria…").fill("Bogota");
    await page.getByRole("option", { name: "America/Bogota" }).click();

    await page.getByLabel("Tipo de negocio").click();
    await page.getByRole("option", { name: "Barbería" }).click();

    await page.getByLabel("Tu nombre").fill("Ana Gómez");
    await page.getByLabel("Correo electrónico").fill("ana@example.com");
    await page.getByLabel("Contraseña").fill("contraseña-larga");

    await expect(page.getByText("8 de 8 completados")).toBeVisible();

    await page.getByRole("button", { name: "Crear negocio" }).click();

    // Crear el negocio también crea la cuenta Owner y la deja logueada — sin
    // esto, nadie podría entrar a un negocio recién creado (Sprint 21).
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Ana Gómez")).toBeVisible();
  });

  test("muestra errores de validación con campos vacíos", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Crear negocio" }).click();

    // "El nombre debe tener al menos 2 caracteres" ahora es el mensaje de
    // validación tanto del nombre del negocio como del nombre del owner —
    // ambos vacíos, así que aparece dos veces; alcanza con confirmar que
    // aparece, no cuál de las dos instancias.
    await expect(
      page.getByText("El nombre debe tener al menos 2 caracteres").first(),
    ).toBeVisible();
    await expect(page.getByText("Ingresa un teléfono válido")).toBeVisible();
  });
});
