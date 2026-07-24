/**
 * Seed de datos de desarrollo — negocio, catálogo y conversaciones de
 * ejemplo para poder navegar el Inbox sin depender de ningún canal real
 * todavía. Es idempotente: si ya hay conversaciones, no vuelve a crear nada.
 */
import { db } from "../src/lib/db";
import { createOwnerAccount } from "../src/modules/auth";
import { createBusiness, getFirstBusiness } from "../src/modules/business";
import {
  createService,
  createStaffMember,
  listServices,
  listStaffMembers,
} from "../src/modules/catalog";
import { findOrCreateConversation } from "../src/modules/conversation";
import { createAppointment } from "../src/modules/scheduling";
import { addDays, todayInTimezone } from "../src/modules/scheduling/domain";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function ensureBusiness() {
  const existing = await getFirstBusiness();
  if (existing) return existing;

  const business = await createBusiness({
    name: "Barbería El Buen Corte",
    phone: "+57 300 123 4567",
    address: "Calle 45 #12-30, Bogotá",
    timezone: "America/Bogota",
    businessType: "BARBERSHOP",
  });
  console.log(`Negocio de ejemplo creado: ${business.name}`);
  return business;
}

/** Sin esto, el negocio de ejemplo queda sin ninguna cuenta con la que iniciar sesión. */
async function ensureOwnerAccount(businessId: string) {
  const existing = await db.user.count({ where: { businessId } });
  if (existing > 0) return;

  await createOwnerAccount(businessId, {
    email: "owner@example.com",
    password: "atlas-dev-2026",
    name: "Ana Gómez",
  });
  console.log("Cuenta de ejemplo creada: owner@example.com / atlas-dev-2026");
}

async function ensureCatalog(businessId: string) {
  let services = await listServices(businessId);
  if (services.length === 0) {
    await createService(businessId, { name: "Corte de pelo", price: 25000, durationMinutes: 30 });
    await createService(businessId, {
      name: "Corte y barba",
      price: 38000,
      durationMinutes: 45,
    });
    services = await listServices(businessId);
    console.log(`${services.length} servicios de ejemplo creados`);
  }

  let staffMembers = await listStaffMembers(businessId);
  if (staffMembers.length === 0) {
    await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });
    await createStaffMember(businessId, { name: "Beto Ruiz", role: "Barbero" });
    staffMembers = await listStaffMembers(businessId);
    console.log(`${staffMembers.length} miembros del equipo de ejemplo creados`);
  }

  return { services, staffMembers };
}

/** Crea un mensaje con una fecha específica (para que el hilo se vea real) y actualiza la actividad de la conversación. */
async function seedMessage(
  conversationId: string,
  sender: "CLIENT" | "STAFF",
  content: string,
  createdAt: Date,
) {
  await db.message.create({ data: { conversationId, sender, content, createdAt } });
  await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: createdAt } });
}

/**
 * Pone `lastReadAt` en una fecha específica sin tocar `updatedAt` — usar acá
 * `db.conversation.update()` dispararía el `@updatedAt` automático de Prisma
 * y pisaría la cronología que armamos a mano con `seedMessage`.
 */
async function seedLastReadAt(conversationId: string, lastReadAt: Date) {
  await db.$executeRaw`UPDATE "conversations" SET "lastReadAt" = ${lastReadAt} WHERE id = ${conversationId}`;
}

async function seedConversations(
  businessId: string,
  businessTimezone: string,
  services: Awaited<ReturnType<typeof listServices>>,
  staffMembers: Awaited<ReturnType<typeof listStaffMembers>>,
) {
  const existingConversations = await db.conversation.count({ where: { businessId } });
  if (existingConversations > 0) {
    console.log("Ya hay conversaciones — no se generan datos de ejemplo de nuevo.");
    return;
  }

  const now = Date.now();
  const today = todayInTimezone(businessTimezone);
  const [corte, corteYBarba] = services;
  const [ana, beto] = staffMembers;

  // María Gómez — WhatsApp, leída, con una reserva próxima.
  const maria = await createAppointment(businessId, businessTimezone, {
    staffId: ana.id,
    serviceId: corte.id,
    clientName: "María Gómez",
    clientPhone: "+57 301 555 0101",
    date: addDays(today, 3),
    time: "10:00",
  });
  const mariaConversation = await findOrCreateConversation(businessId, maria.clientId, "WHATSAPP");
  await seedMessage(
    mariaConversation.id,
    "CLIENT",
    "Hola! Quería consultar si tienen turno para un corte esta semana.",
    new Date(now - 2 * DAY),
  );
  await seedMessage(
    mariaConversation.id,
    "STAFF",
    "¡Hola María! Sí, tenemos disponibilidad. ¿Te viene bien el jueves a las 10am con Ana?",
    new Date(now - 2 * DAY + 6 * 60 * 1000),
  );
  await seedMessage(
    mariaConversation.id,
    "CLIENT",
    "Perfecto, ahí estaré. ¡Gracias!",
    new Date(now - 2 * DAY + 12 * 60 * 1000),
  );
  await seedLastReadAt(mariaConversation.id, new Date(now - 2 * DAY + 15 * 60 * 1000));

  // Carlos Ruiz — Instagram, sin leer, con una reserva pasada.
  const carlos = await createAppointment(businessId, businessTimezone, {
    staffId: beto.id,
    serviceId: corteYBarba.id,
    clientName: "Carlos Ruiz",
    clientPhone: "+57 302 555 0102",
    date: addDays(today, -10),
    time: "16:00",
  });
  const carlosConversation = await findOrCreateConversation(
    businessId,
    carlos.clientId,
    "INSTAGRAM",
  );
  await seedMessage(
    carlosConversation.id,
    "CLIENT",
    "Buenas, ¿cuánto cuesta el corte con barba?",
    new Date(now - 10 * DAY),
  );
  await seedMessage(
    carlosConversation.id,
    "STAFF",
    "¡Hola Carlos! El corte con barba sale $38.000 y dura unos 45 minutos.",
    new Date(now - 10 * DAY + 4 * 60 * 1000),
  );
  await seedMessage(
    carlosConversation.id,
    "CLIENT",
    "Genial, voy a ir mañana entonces.",
    new Date(now - 10 * DAY + 8 * 60 * 1000),
  );
  await seedLastReadAt(carlosConversation.id, new Date(now - 10 * DAY + 10 * 60 * 1000));
  await seedMessage(
    carlosConversation.id,
    "CLIENT",
    "Hola de nuevo! ¿Puedo cambiar el turno de la próxima semana?",
    new Date(now - 30 * 60 * 1000),
  );
  // lastReadAt queda antes de este último mensaje a propósito — así se ve como no leída.

  // Laura Torres — SMS, sin leer, todavía sin ninguna reserva (prueba el
  // estado vacío del panel derecho).
  const laura = await db.client.create({ data: { businessId, name: "Laura Torres" } });
  const lauraConversation = await findOrCreateConversation(businessId, laura.id, "SMS");
  await seedMessage(
    lauraConversation.id,
    "CLIENT",
    "Hola, ¿atienden los domingos?",
    new Date(now - 1 * HOUR),
  );

  // Pedro Sánchez — Chat web, leída, sin reservas.
  const pedroClient = await db.client.create({
    data: { businessId, name: "Pedro Sánchez" },
  });
  const pedroConversation = await findOrCreateConversation(businessId, pedroClient.id, "WEB_CHAT");
  await seedMessage(
    pedroConversation.id,
    "CLIENT",
    "Quería saber los horarios de atención.",
    new Date(now - 1 * DAY),
  );
  await seedMessage(
    pedroConversation.id,
    "STAFF",
    "¡Hola Pedro! Atendemos de lunes a sábado de 8am a 8pm.",
    new Date(now - 1 * DAY + 5 * 60 * 1000),
  );
  await seedLastReadAt(pedroConversation.id, new Date(now - 1 * DAY + 6 * 60 * 1000));

  console.log("4 conversaciones de ejemplo creadas (WhatsApp, Instagram, SMS, Chat web).");
}

async function main() {
  // Crea una cuenta OWNER con una contraseña fija y pública
  // ("atlas-dev-2026", ver ensureOwnerAccount más abajo) — un backdoor de
  // login real si esto llegara a correr contra producción. No hay ningún
  // escenario legítimo para sembrar datos de demo ahí: los negocios reales
  // se dan de alta con su propia cuenta desde el flujo de Business Setup.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "prisma/seed.ts: NODE_ENV=production — cancelado. Este seed crea una cuenta " +
        "con contraseña pública fija, pensada solo para desarrollo local.",
    );
    process.exitCode = 1;
    return;
  }

  const business = await ensureBusiness();
  await ensureOwnerAccount(business.id);
  const { services, staffMembers } = await ensureCatalog(business.id);

  if (services.length < 2 || staffMembers.length < 2) {
    console.log(
      "Se necesitan al menos 2 servicios y 2 miembros del equipo para generar conversaciones de ejemplo — saltando.",
    );
    return;
  }

  await seedConversations(business.id, business.timezone, services, staffMembers);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
