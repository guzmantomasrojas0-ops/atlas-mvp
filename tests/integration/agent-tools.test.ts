import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createAppointmentTool,
  findServiceTool,
  findStaffTool,
  getBusinessHoursTool,
  getUpcomingAppointmentsTool,
  prepareBookingSummaryTool,
  searchAvailabilityTool,
} from "@/modules/agent";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember } from "@/modules/catalog";
import { createAppointment } from "@/modules/scheduling";
import { addDays, toUtcInstant, todayInTimezone } from "@/modules/scheduling/domain";

const TIMEZONE = "America/Bogota";

let businessId: string;
let businessName: string;
let corteId: string;
let corteYBarbaId: string;
let anaId: string;
let betoId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (agent tools)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;
  businessName = business.name;

  const corte = await createService(businessId, {
    name: "Corte de pelo",
    price: 25000,
    durationMinutes: 30,
  });
  corteId = corte.id;
  const corteYBarba = await createService(businessId, {
    name: "Corte y barba",
    price: 38000,
    durationMinutes: 45,
  });
  corteYBarbaId = corteYBarba.id;

  const ana = await createStaffMember(businessId, { name: "Ana Gómez", role: "Barbera" });
  anaId = ana.id;
  const beto = await createStaffMember(businessId, { name: "Beto Ruiz", role: "Barbero" });
  betoId = beto.id;
});

afterEach(async () => {
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("agent tools — integración con Postgres real", () => {
  it("findServiceTool busca por nombre real del catálogo", async () => {
    const all = await findServiceTool.execute({ businessId });
    expect(all.services.map((s) => s.name).sort()).toEqual(["Corte de pelo", "Corte y barba"]);

    const filtered = await findServiceTool.execute({ businessId, query: "barba" });
    expect(filtered.services.map((s) => s.id)).toEqual([corteYBarbaId]);
  });

  it("findStaffTool busca por nombre real del equipo", async () => {
    const all = await findStaffTool.execute({ businessId });
    expect(all.staff.map((s) => s.name).sort()).toEqual(["Ana Gómez", "Beto Ruiz"]);

    const filtered = await findStaffTool.execute({ businessId, query: "gomez" });
    expect(filtered.staff.map((s) => s.id)).toEqual([anaId]);
  });

  it("getBusinessHoursTool devuelve el negocio real que se le pasa", async () => {
    const output = await getBusinessHoursTool.execute({
      businessName,
      businessTimezone: TIMEZONE,
    });
    expect(output.businessName).toBe(businessName);
    expect(output.timezone).toBe(TIMEZONE);
  });

  it("getUpcomingAppointmentsTool trae solo las reservas futuras reales del cliente", async () => {
    const today = todayInTimezone(TIMEZONE);
    const future = await createAppointment(businessId, TIMEZONE, {
      staffId: anaId,
      serviceId: corteId,
      clientName: "María Gómez",
      clientPhone: "",
      date: addDays(today, 5),
      time: "10:00",
    });
    await createAppointment(businessId, TIMEZONE, {
      staffId: betoId,
      serviceId: corteYBarbaId,
      clientName: "María Gómez",
      clientPhone: "",
      date: addDays(today, -5),
      time: "10:00",
    });

    const output = await getUpcomingAppointmentsTool.execute({
      businessId,
      clientId: future.clientId,
    });

    expect(output.appointments).toHaveLength(1);
    expect(output.appointments[0].id).toBe(future.id);
  });

  it("searchAvailabilityTool descuenta una reserva real del staff pedido", async () => {
    const today = todayInTimezone(TIMEZONE);
    const bookedDate = addDays(today, 3);
    await createAppointment(businessId, TIMEZONE, {
      staffId: anaId,
      serviceId: corteId,
      clientName: "Cliente existente",
      clientPhone: "",
      date: bookedDate,
      time: "10:00",
    });

    const output = await searchAvailabilityTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      date: bookedDate,
      serviceDurationMinutes: 30,
      staffId: anaId,
    });

    expect(output.date).toBe(bookedDate);
    expect(output.availability).toHaveLength(1);
    const [anaAvailability] = output.availability;
    expect(anaAvailability.staffId).toBe(anaId);
    expect(anaAvailability.slots.length).toBeGreaterThan(0);

    const bookedSlotStart = toUtcInstant(bookedDate, "10:00", TIMEZONE).getTime();
    expect(anaAvailability.slots.some((slot) => slot.startsAt.getTime() === bookedSlotStart)).toBe(
      false,
    );
  });

  it("searchAvailabilityTool sin staffId cubre a todo el equipo real", async () => {
    const today = todayInTimezone(TIMEZONE);
    const output = await searchAvailabilityTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      date: addDays(today, 3),
      serviceDurationMinutes: 30,
    });

    expect(output.availability.map((a) => a.staffId).sort()).toEqual([anaId, betoId].sort());
  });

  it("prepareBookingSummaryTool arma el resumen real cuando el horario sigue libre", async () => {
    const today = todayInTimezone(TIMEZONE);
    const date = addDays(today, 3);

    const output = await prepareBookingSummaryTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      serviceId: corteId,
      staffId: anaId,
      date,
      time: "14:00",
    });

    expect(output.summary).toMatchObject({
      service: { id: corteId, name: "Corte de pelo", price: 25000, durationMinutes: 30 },
      staff: { id: anaId, name: "Ana Gómez" },
      date,
      time: "14:00",
      isAvailable: true,
    });
    expect(output.summary.note).toContain("no se guardó");
  });

  it("prepareBookingSummaryTool marca isAvailable=false si una reserva real ya ocupó ese horario", async () => {
    const today = todayInTimezone(TIMEZONE);
    const date = addDays(today, 3);
    await createAppointment(businessId, TIMEZONE, {
      staffId: anaId,
      serviceId: corteId,
      clientName: "Cliente existente",
      clientPhone: "",
      date,
      time: "14:00",
    });

    const output = await prepareBookingSummaryTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      serviceId: corteId,
      staffId: anaId,
      date,
      time: "14:00",
    });

    expect(output.summary.isAvailable).toBe(false);
    expect(output.summary.note).toContain("ya no está disponible");
  });

  it("prepareBookingSummaryTool rechaza un serviceId/staffId real pero inexistente en este negocio", async () => {
    await expect(
      prepareBookingSummaryTool.execute({
        businessId,
        businessTimezone: TIMEZONE,
        serviceId: "no-existe",
        staffId: anaId,
        date: addDays(todayInTimezone(TIMEZONE), 3),
        time: "14:00",
      }),
    ).rejects.toThrow("El servicio indicado no existe.");
  });

  it("createAppointmentTool crea la cita real y no toca al cliente por su nombre", async () => {
    const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
    const date = addDays(todayInTimezone(TIMEZONE), 3);

    const output = await createAppointmentTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      clientId: client.id,
      serviceId: corteId,
      staffId: anaId,
      date,
      time: "14:00",
    });

    expect(output.appointment).toMatchObject({
      service: { id: corteId, name: "Corte de pelo", price: 25000 },
      staff: { id: anaId, name: "Ana Gómez" },
    });

    const appointment = await db.appointment.findUnique({ where: { id: output.appointment.id } });
    expect(appointment?.businessId).toBe(businessId);
    expect(appointment?.clientId).toBe(client.id);

    const clients = await db.client.findMany({ where: { businessId } });
    expect(clients).toHaveLength(1);
  });

  it("createAppointmentTool reporta un horario ya ocupado como error estructurado, sin crear una segunda cita", async () => {
    const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
    const date = addDays(todayInTimezone(TIMEZONE), 3);

    await createAppointmentTool.execute({
      businessId,
      businessTimezone: TIMEZONE,
      clientId: client.id,
      serviceId: corteId,
      staffId: anaId,
      date,
      time: "14:00",
    });

    await expect(
      createAppointmentTool.execute({
        businessId,
        businessTimezone: TIMEZONE,
        clientId: client.id,
        serviceId: corteId,
        staffId: anaId,
        date,
        time: "14:15",
      }),
    ).rejects.toThrow(/ocupado/);

    const count = await db.appointment.count({ where: { businessId } });
    expect(count).toBe(1);
  });

  it("createAppointmentTool rechaza un servicio o profesional inexistente sin crear nada", async () => {
    const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
    const date = addDays(todayInTimezone(TIMEZONE), 3);

    await expect(
      createAppointmentTool.execute({
        businessId,
        businessTimezone: TIMEZONE,
        clientId: client.id,
        serviceId: "no-existe",
        staffId: anaId,
        date,
        time: "14:00",
      }),
    ).rejects.toThrow(/no existe/);

    await expect(
      createAppointmentTool.execute({
        businessId,
        businessTimezone: TIMEZONE,
        clientId: client.id,
        serviceId: corteId,
        staffId: "no-existe",
        date,
        time: "14:00",
      }),
    ).rejects.toThrow(/no existe/);

    const count = await db.appointment.count({ where: { businessId } });
    expect(count).toBe(0);
  });
});
