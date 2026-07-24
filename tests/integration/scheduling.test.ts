import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createBusiness } from "@/modules/business";
import { createService, createStaffMember, setStaffMemberActive } from "@/modules/catalog";
import {
  AppointmentNotFoundError,
  cancelAppointment,
  createAppointment,
  createAppointmentForClient,
  listAppointments,
  rescheduleAppointment,
  searchAvailability,
  InvalidReferenceError,
  OutsideBusinessHoursError,
  SchedulingConflictError,
} from "@/modules/scheduling";

const TIMEZONE = "America/Bogota";

let businessId: string;
let serviceId: string;
let staffId: string;

beforeEach(async () => {
  const business = await createBusiness({
    name: "Negocio de prueba (scheduling)",
    phone: "+57 300 000 0000",
    address: "Calle Falsa 123",
    timezone: TIMEZONE,
    businessType: "BARBERSHOP",
  });
  businessId = business.id;

  const service = await createService(businessId, {
    name: "Corte",
    price: 25000,
    durationMinutes: 30,
  });
  serviceId = service.id;

  const staffMember = await createStaffMember(businessId, { name: "Ana", role: "Barbera" });
  staffId = staffMember.id;
});

afterEach(async () => {
  await db.appointment.deleteMany({ where: { businessId } });
  await db.client.deleteMany({ where: { businessId } });
  await db.service.deleteMany({ where: { businessId } });
  await db.staffMember.deleteMany({ where: { businessId } });
  await db.business.delete({ where: { id: businessId } });
});

describe("scheduling module — integración con Postgres real", () => {
  it("crea una reserva y la lista dentro de su rango", async () => {
    const created = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Juan Pérez",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    expect(created.staffId).toBe(staffId);

    const list = await listAppointments(
      businessId,
      new Date("2026-07-20T00:00:00Z"),
      new Date("2026-07-21T00:00:00Z"),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ clientName: "Juan Pérez", staffId, serviceId });
  });

  it("reutiliza un cliente existente por nombre (sin distinguir mayúsculas)", async () => {
    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Juan Pérez",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "juan pérez",
      clientPhone: "",
      date: "2026-07-21",
      time: "10:00",
    });

    const clients = await db.client.findMany({ where: { businessId } });
    expect(clients).toHaveLength(1);
  });

  it("rechaza una reserva que se superpone con otra del mismo staff", async () => {
    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 1",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });

    await expect(
      createAppointment(businessId, TIMEZONE, {
        staffId,
        serviceId,
        clientName: "Cliente 2",
        clientPhone: "",
        date: "2026-07-20",
        time: "10:15",
      }),
    ).rejects.toThrow(SchedulingConflictError);
  });

  it("rechaza una reserva NUEVA para un miembro del equipo desactivado", async () => {
    await setStaffMemberActive(businessId, staffId, false);

    await expect(
      createAppointment(businessId, TIMEZONE, {
        staffId,
        serviceId,
        clientName: "Cliente 1",
        clientPhone: "",
        date: "2026-07-20",
        time: "10:00",
      }),
    ).rejects.toThrow(InvalidReferenceError);
  });

  it("SEARCH_AVAILABILITY excluye a un miembro del equipo desactivado cuando se pide disponibilidad de todo el equipo", async () => {
    await setStaffMemberActive(businessId, staffId, false);

    const availability = await searchAvailability(businessId, TIMEZONE, "2026-07-20", 30);

    expect(availability.find((entry) => entry.staffId === staffId)).toBeUndefined();
  });

  it("reprogramar una cita YA existente con un staff luego desactivado sigue funcionando", async () => {
    const created = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 1",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });

    await setStaffMemberActive(businessId, staffId, false);

    const rescheduled = await rescheduleAppointment(businessId, TIMEZONE, created.id, {
      date: "2026-07-20",
      time: "14:00",
    });

    expect(rescheduled.startsAt.getTime()).not.toBe(created.startsAt.getTime());
  });

  it("permite reservas superpuestas si son de miembros del equipo distintos", async () => {
    const otherStaff = await createStaffMember(businessId, { name: "Beto", role: "Barbero" });

    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 1",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    const second = await createAppointment(businessId, TIMEZONE, {
      staffId: otherStaff.id,
      serviceId,
      clientName: "Cliente 2",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });

    expect(second.staffId).toBe(otherStaff.id);
  });

  it("una reserva cancelada no bloquea el horario para una nueva", async () => {
    const first = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 1",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    await db.appointment.update({ where: { id: first.id }, data: { status: "CANCELLED" } });

    const second = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 2",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    expect(second.id).not.toBe(first.id);
  });

  it("impide la doble reserva a nivel de base bajo condiciones de carrera (constraint EXCLUDE)", async () => {
    const attempt = (clientName: string) =>
      createAppointment(businessId, TIMEZONE, {
        staffId,
        serviceId,
        clientName,
        clientPhone: "",
        date: "2026-07-22",
        time: "14:00",
      });

    const results = await Promise.allSettled([attempt("Carrera 1"), attempt("Carrera 2")]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(SchedulingConflictError);
    }
  });

  it("rechaza datos inválidos antes de tocar la base", async () => {
    const before = await db.appointment.count({ where: { businessId } });

    await expect(
      createAppointment(businessId, TIMEZONE, {
        staffId: "",
        serviceId,
        clientName: "a",
        clientPhone: "abc",
        date: "no-es-una-fecha",
        time: "99:99",
      }),
    ).rejects.toThrow();

    const after = await db.appointment.count({ where: { businessId } });
    expect(after).toBe(before);
  });

  it("rechaza un staffId que no existe en este negocio", async () => {
    await expect(
      createAppointment(businessId, TIMEZONE, {
        staffId: "no-existe",
        serviceId,
        clientName: "Cliente",
        clientPhone: "",
        date: "2026-07-20",
        time: "10:00",
      }),
    ).rejects.toThrow(/no existe/);
  });

  it("searchAvailability descuenta las reservas reales del staff pedido", async () => {
    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 1",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });

    const [availability] = await searchAvailability(
      businessId,
      TIMEZONE,
      "2026-07-20",
      30,
      staffId,
    );

    expect(availability.staffId).toBe(staffId);
    expect(
      availability.slots.some(
        (slot) => slot.startsAt.getTime() === new Date("2026-07-20T15:00:00Z").getTime(),
      ),
    ).toBe(false);
    expect(availability.slots.length).toBeGreaterThan(0);
  });

  it("searchAvailability sin staffId devuelve la disponibilidad de todo el equipo", async () => {
    const otherStaff = await createStaffMember(businessId, { name: "Beto", role: "Barbero" });

    const availability = await searchAvailability(businessId, TIMEZONE, "2026-07-20", 30);

    expect(availability.map((a) => a.staffId).sort()).toEqual([staffId, otherStaff.id].sort());
  });

  it("searchAvailability para un staffId que no existe devuelve una lista vacía", async () => {
    const availability = await searchAvailability(
      businessId,
      TIMEZONE,
      "2026-07-20",
      30,
      "no-existe",
    );
    expect(availability).toEqual([]);
  });
});

describe("createAppointmentForClient — Sprint 14, comparte toda la validación con createAppointment", () => {
  // Reutiliza el business/service/staff que ya crea el beforeEach del
  // archivo (arriba) — este bloque solo agrega el cliente que le falta,
  // para no pelearse con ese mismo beforeEach/afterEach por las variables
  // compartidas businessId/serviceId/staffId (crear un segundo negocio acá
  // y reasignarlas rompía la limpieza del hook de afuera).
  let clientId: string;

  beforeEach(async () => {
    const client = await db.client.create({ data: { businessId, name: "María Gómez" } });
    clientId = client.id;
  });

  it("crea la cita para el clientId dado — nunca busca ni crea un cliente por nombre", async () => {
    const created = await createAppointmentForClient(businessId, TIMEZONE, {
      clientId,
      serviceId,
      staffId,
      date: "2026-07-20",
      time: "10:00",
    });

    expect(created.service).toMatchObject({ id: serviceId, name: "Corte", price: 25000 });
    expect(created.staff).toMatchObject({ id: staffId, name: "Ana" });

    const appointment = await db.appointment.findUnique({ where: { id: created.id } });
    expect(appointment?.clientId).toBe(clientId);

    const clients = await db.client.findMany({ where: { businessId } });
    expect(clients).toHaveLength(1);
    expect(clients[0].id).toBe(clientId);
  });

  it("rechaza un serviceId que no existe en este negocio", async () => {
    await expect(
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId: "no-existe",
        staffId,
        date: "2026-07-20",
        time: "10:00",
      }),
    ).rejects.toThrow(InvalidReferenceError);
  });

  it("rechaza un staffId que no existe en este negocio", async () => {
    await expect(
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId,
        staffId: "no-existe",
        date: "2026-07-20",
        time: "10:00",
      }),
    ).rejects.toThrow(InvalidReferenceError);
  });

  it("rechaza un servicio de OTRO negocio, aunque el id exista de verdad", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 111 2222",
      address: "Otra calle 456",
      timezone: TIMEZONE,
      businessType: "SALON",
    });
    const otherService = await createService(otherBusiness.id, {
      name: "Manicura",
      price: 15000,
      durationMinutes: 30,
    });

    await expect(
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId: otherService.id,
        staffId,
        date: "2026-07-20",
        time: "10:00",
      }),
    ).rejects.toThrow(InvalidReferenceError);

    await db.service.delete({ where: { id: otherService.id } });
    await db.business.delete({ where: { id: otherBusiness.id } });
  });

  it("rechaza un horario fuera de la jornada laboral", async () => {
    await expect(
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId,
        staffId,
        date: "2026-07-20",
        time: "03:00",
      }),
    ).rejects.toThrow(OutsideBusinessHoursError);

    const count = await db.appointment.count({ where: { businessId } });
    expect(count).toBe(0);
  });

  it("rechaza un horario que ya está ocupado por otra reserva real del mismo staff", async () => {
    await createAppointmentForClient(businessId, TIMEZONE, {
      clientId,
      serviceId,
      staffId,
      date: "2026-07-20",
      time: "10:00",
    });

    await expect(
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId,
        staffId,
        date: "2026-07-20",
        time: "10:15",
      }),
    ).rejects.toThrow(SchedulingConflictError);

    const count = await db.appointment.count({ where: { businessId } });
    expect(count).toBe(1);
  });

  it("no crea una cita duplicada bajo una carrera — el constraint EXCLUDE sigue siendo el backstop real", async () => {
    const attempt = () =>
      createAppointmentForClient(businessId, TIMEZONE, {
        clientId,
        serviceId,
        staffId,
        date: "2026-07-22",
        time: "14:00",
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(SchedulingConflictError);
    }

    const count = await db.appointment.count({ where: { businessId } });
    expect(count).toBe(1);
  });
});

describe("cancelAppointment — Sprint 17, la única operación de escritura del Dashboard sobre una cita ya creada", () => {
  // Mismo motivo que el bloque de arriba: reutiliza el business/service/staff
  // del beforeEach del archivo, solo agrega lo que le falta acá.
  let appointmentId: string;

  beforeEach(async () => {
    const created = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente a cancelar",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    appointmentId = created.id;
  });

  it("cancela una reserva confirmada — su status pasa a CANCELLED", async () => {
    await expect(cancelAppointment(businessId, appointmentId)).resolves.toBeUndefined();

    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(appointment.status).toBe("CANCELLED");
  });

  it("libera el horario — una nueva reserva puede ocupar el mismo slot después de cancelar", async () => {
    await cancelAppointment(businessId, appointmentId);

    const second = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente 2",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    expect(second.id).not.toBe(appointmentId);
  });

  it("tira AppointmentNotFoundError si el id no existe", async () => {
    await expect(cancelAppointment(businessId, "no-existe")).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });

  it("tira AppointmentNotFoundError si la reserva es de otro negocio (aislamiento entre tenants)", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 000 0001",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });

    try {
      await expect(cancelAppointment(otherBusiness.id, appointmentId)).rejects.toThrow(
        AppointmentNotFoundError,
      );
      // La reserva real sigue confirmada — el intento fallido no la tocó.
      const appointment = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      expect(appointment.status).toBe("CONFIRMED");
    } finally {
      await db.business.delete({ where: { id: otherBusiness.id } });
    }
  });

  it("tira AppointmentNotFoundError si ya estaba cancelada (no se puede cancelar dos veces)", async () => {
    await cancelAppointment(businessId, appointmentId);
    await expect(cancelAppointment(businessId, appointmentId)).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });
});

describe("rescheduleAppointment — Sprint 19, reutiliza toda la validación de createAppointment", () => {
  // Mismo motivo que los bloques de arriba: reutiliza el business/service/staff
  // del beforeEach del archivo, solo agrega lo que le falta acá.
  let appointmentId: string;

  beforeEach(async () => {
    const created = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Cliente a reprogramar",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    appointmentId = created.id;
  });

  it("mueve la cita a un nuevo horario, manteniendo servicio/staff/cliente", async () => {
    const before = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });

    const updated = await rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
      date: "2026-07-21",
      time: "16:00",
    });

    expect(updated.id).toBe(appointmentId);
    expect(updated.staffId).toBe(staffId);
    expect(updated.serviceId).toBe(serviceId);
    expect(updated.clientId).toBe(before.clientId);
    expect(updated.startsAt.getTime()).toBe(new Date("2026-07-21T21:00:00Z").getTime());
  });

  it("libera el horario viejo — una nueva reserva puede ocupar el slot original después de reprogramar", async () => {
    await rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
      date: "2026-07-21",
      time: "16:00",
    });

    const second = await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Otro cliente",
      clientPhone: "",
      date: "2026-07-20",
      time: "10:00",
    });
    expect(second.id).not.toBe(appointmentId);
  });

  it("no se rechaza a sí misma: un nuevo horario que se superpone con su propio horario viejo no cuenta como conflicto", async () => {
    // La cita original ocupa 10:00–10:30. Moverla a 10:15 hace que el nuevo
    // rango (10:15–10:45) se superponga con su PROPIO horario viejo — sin
    // excluirse a sí misma del chequeo, esto se rechazaría como conflicto.
    const updated = await rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
      date: "2026-07-20",
      time: "10:15",
    });
    expect(updated.startsAt.getTime()).toBe(new Date("2026-07-20T15:15:00Z").getTime());
  });

  it("rechaza un nuevo horario que choca con OTRA reserva real del mismo staff", async () => {
    await createAppointment(businessId, TIMEZONE, {
      staffId,
      serviceId,
      clientName: "Otro cliente",
      clientPhone: "",
      date: "2026-07-21",
      time: "16:00",
    });

    await expect(
      rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
        date: "2026-07-21",
        time: "16:15",
      }),
    ).rejects.toThrow(SchedulingConflictError);

    const stillOriginal = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(stillOriginal.startsAt.getTime()).toBe(new Date("2026-07-20T15:00:00Z").getTime());
  });

  it("permite reprogramar a un horario superpuesto si es de OTRO miembro del equipo", async () => {
    const otherStaff = await createStaffMember(businessId, { name: "Beto", role: "Barbero" });
    await createAppointment(businessId, TIMEZONE, {
      staffId: otherStaff.id,
      serviceId,
      clientName: "Cliente de Beto",
      clientPhone: "",
      date: "2026-07-21",
      time: "16:00",
    });

    const updated = await rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
      date: "2026-07-21",
      time: "16:00",
    });
    expect(updated.staffId).toBe(staffId);
  });

  it("rechaza un horario fuera de la jornada laboral, sin mover la cita", async () => {
    await expect(
      rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
        date: "2026-07-20",
        time: "03:00",
      }),
    ).rejects.toThrow(OutsideBusinessHoursError);

    const stillOriginal = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(stillOriginal.startsAt.getTime()).toBe(new Date("2026-07-20T15:00:00Z").getTime());
  });

  it("rechaza datos inválidos antes de tocar la base", async () => {
    await expect(
      rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
        date: "no-es-una-fecha",
        time: "99:99",
      }),
    ).rejects.toThrow();

    const stillOriginal = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(stillOriginal.startsAt.getTime()).toBe(new Date("2026-07-20T15:00:00Z").getTime());
  });

  it("tira AppointmentNotFoundError si el id no existe", async () => {
    await expect(
      rescheduleAppointment(businessId, TIMEZONE, "no-existe", {
        date: "2026-07-21",
        time: "16:00",
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it("tira AppointmentNotFoundError si la reserva es de otro negocio (aislamiento entre tenants)", async () => {
    const otherBusiness = await createBusiness({
      name: "Otro negocio",
      phone: "+57 300 000 0002",
      address: "Otra calle",
      timezone: TIMEZONE,
      businessType: "BARBERSHOP",
    });

    try {
      await expect(
        rescheduleAppointment(otherBusiness.id, TIMEZONE, appointmentId, {
          date: "2026-07-21",
          time: "16:00",
        }),
      ).rejects.toThrow(AppointmentNotFoundError);

      const stillOriginal = await db.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
      });
      expect(stillOriginal.startsAt.getTime()).toBe(new Date("2026-07-20T15:00:00Z").getTime());
    } finally {
      await db.business.delete({ where: { id: otherBusiness.id } });
    }
  });

  it("tira AppointmentNotFoundError si la cita ya está cancelada", async () => {
    await cancelAppointment(businessId, appointmentId);

    await expect(
      rescheduleAppointment(businessId, TIMEZONE, appointmentId, {
        date: "2026-07-21",
        time: "16:00",
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });
});
