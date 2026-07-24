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

async function seedBusiness() {
  return withDb(async (client) => {
    const business = await client.query(
      `INSERT INTO businesses (id, name, phone, address, timezone, "businessType", "createdAt", "updatedAt")
       VALUES ('res-e2e-business', 'Barbería Reservas E2E', '+57 300 000 0000', 'Calle Falsa 123', 'America/Bogota', 'BARBERSHOP', now(), now())
       RETURNING id`,
    );
    const businessId = business.rows[0].id as string;

    await client.query(
      `INSERT INTO services (id, "businessId", name, price, "durationMinutes", "createdAt", "updatedAt")
       VALUES ('res-e2e-service', $1, 'Corte de pelo', 25000, 30, now(), now())`,
      [businessId],
    );
    await client.query(
      `INSERT INTO staff_members (id, "businessId", name, role, "createdAt", "updatedAt")
       VALUES ('res-e2e-staff', $1, 'Ana Gómez', 'Barbera', now(), now())`,
      [businessId],
    );

    return businessId;
  });
}

/**
 * Bogotá es UTC-5 fijo (sin horario de verano) — construye el instante UTC
 * correspondiente a "hoy, hora:minuto en Bogotá", sin depender de la zona
 * horaria de la máquina donde corre el test. Usar siempre "hoy" (nunca un
 * offset relativo tipo "+3 horas") es lo que garantiza que la cita quede
 * dentro de la misma semana que ya se ve en pantalla — un offset relativo
 * puede cruzar medianoche o el borde de la semana según a qué hora corra
 * el test, y sacar la cita de la vista sin que sea un bug real.
 */
function bogotaTodayAt(hour: number, minute: number): Date {
  const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(
      nowBogota.getUTCFullYear(),
      nowBogota.getUTCMonth(),
      nowBogota.getUTCDate(),
      hour + 5,
      minute,
    ),
  );
}

function toBogotaDateAndTime(instant: Date): { date: string; time: string } {
  const local = new Date(instant.getTime() - 5 * 60 * 60 * 1000);
  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const min = String(local.getUTCMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

async function seedAppointment() {
  const startsAt = bogotaTodayAt(11, 0);
  const endsAt = bogotaTodayAt(11, 30);
  await withDb(async (client) => {
    await client.query(
      `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
       VALUES ('res-e2e-client', 'res-e2e-business', 'Rosa Martínez', '+57 300 555 0199', now(), now())`,
    );
    await client.query(
      `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "createdAt", "updatedAt")
       VALUES ('res-e2e-appointment', 'res-e2e-business', 'res-e2e-staff', 'res-e2e-service', 'res-e2e-client', $1, $2, 'CONFIRMED', now(), now())`,
      [startsAt, endsAt],
    );
  });
}

// .serial: todos los tests comparten el mismo negocio/servicio/staff — correrlos en paralelo los haría pisarse.
test.describe.serial("Appointments", () => {
  test.beforeEach(async () => {
    await resetAll();
    await seedBusiness();
  });

  test.afterEach(async () => {
    await resetAll();
  });

  test("crea una reserva desde el calendario y aparece en la grilla", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAsUser(context, baseURL!, "res-e2e-business");
    await page.goto("/dashboard/appointments");

    await page.getByLabel("Servicio").click();
    await page.getByRole("option", { name: /Corte de pelo/ }).click();

    await page.getByLabel("Miembro del equipo").click();
    await page.getByRole("option", { name: "Ana Gómez" }).click();

    await page.getByLabel("Hora").click();
    await page.getByRole("option", { name: "10:00", exact: true }).click();

    await page.getByLabel("Nombre del cliente").fill("Juan Pérez");

    await page.getByRole("button", { name: "Crear reserva" }).click();

    await expect(page.getByText("Corte de pelo").first()).toBeVisible();
  });

  test("muestra errores de validación con campos vacíos", async ({ page, context, baseURL }) => {
    await loginAsUser(context, baseURL!, "res-e2e-business");
    await page.goto("/dashboard/appointments");

    await page.getByRole("button", { name: "Crear reserva" }).click();

    // El placeholder del Select coincide textualmente con su propio mensaje
    // de error ("Selecciona un servicio") — se busca el mensaje puntualmente
    // por su rol de alerta, no por texto, para no matchear ambos.
    await expect(
      page.getByRole("alert").filter({ hasText: "Selecciona un servicio" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Selecciona un miembro del equipo" }),
    ).toBeVisible();
  });

  test("redirige a /login si no hay una sesión válida", async ({ page }) => {
    await resetAll();
    await page.goto("/dashboard/appointments");
    await expect(page).toHaveURL("/login");
  });

  test("la vista por día muestra un estado vacío si no hay equipo", async ({
    page,
    context,
    baseURL,
  }) => {
    await withDb((client) => client.query("DELETE FROM staff_members"));
    await loginAsUser(context, baseURL!, "res-e2e-business");
    await page.goto("/dashboard/appointments?view=day");
    await expect(page.getByText("Agrega tu equipo primero")).toBeVisible();
  });

  test("reprograma una reserva desde el detalle y el nuevo horario persiste tras refrescar", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedAppointment();
    await loginAsUser(context, baseURL!, "res-e2e-business");
    const newSlot = toBogotaDateAndTime(bogotaTodayAt(14, 0));

    await page.goto("/dashboard/appointments");
    await page.getByRole("button", { name: /Rosa Martínez/ }).click();
    await page.getByRole("button", { name: "Reprogramar" }).click();

    await page.locator('input[type="date"]').fill(newSlot.date);
    await page.locator('input[type="time"]').fill(newSlot.time);
    await page.getByRole("button", { name: "Guardar" }).click();

    // Al guardar con éxito el panel vuelve al modo normal (ya no muestra
    // "Guardar"/"Cancelar" del formulario de reprogramar).
    await expect(page.getByRole("button", { name: "Reprogramar" })).toBeVisible();
    await expect(page.getByText(`${newSlot.time} –`)).toBeVisible();

    // La persistencia es correcta: sigue en el horario nuevo después de refrescar.
    await page.reload();
    await page.getByRole("button", { name: /Rosa Martínez/ }).click();
    await expect(page.getByText(`${newSlot.time} –`)).toBeVisible();
  });

  test("no permite reprogramar a un horario ocupado por otra reserva real del mismo staff", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedAppointment();
    await loginAsUser(context, baseURL!, "res-e2e-business");
    await withDb((client) =>
      client.query(
        `INSERT INTO clients (id, "businessId", name, phone, "createdAt", "updatedAt")
         VALUES ('res-e2e-client-2', 'res-e2e-business', 'Diego Salas', '+57 300 555 0188', now(), now())`,
      ),
    );
    const occupiedStartsAt = bogotaTodayAt(16, 0);
    const occupiedEndsAt = bogotaTodayAt(16, 30);
    const occupiedSlot = toBogotaDateAndTime(occupiedStartsAt);
    await withDb((client) =>
      client.query(
        `INSERT INTO appointments (id, "businessId", "staffId", "serviceId", "clientId", "startsAt", "endsAt", status, "createdAt", "updatedAt")
         VALUES ('res-e2e-appointment-2', 'res-e2e-business', 'res-e2e-staff', 'res-e2e-service', 'res-e2e-client-2', $1, $2, 'CONFIRMED', now(), now())`,
        [occupiedStartsAt, occupiedEndsAt],
      ),
    );

    await page.goto("/dashboard/appointments");
    await page.getByRole("button", { name: /Rosa Martínez/ }).click();
    await page.getByRole("button", { name: "Reprogramar" }).click();

    await page.locator('input[type="date"]').fill(occupiedSlot.date);
    await page.locator('input[type="time"]').fill(occupiedSlot.time);
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText(/ocupado/)).toBeVisible();
  });
});
