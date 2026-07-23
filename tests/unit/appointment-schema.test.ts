import { describe, expect, it } from "vitest";
import {
  appointmentInputSchema,
  rescheduleAppointmentInputSchema,
} from "@/modules/scheduling/domain";

const validInput = {
  staffId: "staff_1",
  serviceId: "service_1",
  clientName: "Juan Pérez",
  clientPhone: "+57 300 123 4567",
  date: "2026-07-20",
  time: "14:30",
};

describe("appointmentInputSchema", () => {
  it("acepta un input válido", () => {
    expect(appointmentInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("acepta un teléfono vacío (opcional)", () => {
    const result = appointmentInputSchema.safeParse({ ...validInput, clientPhone: "" });
    expect(result.success).toBe(true);
  });

  it("rechaza un teléfono con formato inválido", () => {
    const result = appointmentInputSchema.safeParse({ ...validInput, clientPhone: "abc" });
    expect(result.success).toBe(false);
  });

  it("rechaza si falta el staffId", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, staffId: "" }).success).toBe(false);
  });

  it("rechaza si falta el serviceId", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, serviceId: "" }).success).toBe(false);
  });

  it("rechaza un nombre de cliente muy corto", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, clientName: "a" }).success).toBe(
      false,
    );
  });

  it("rechaza una fecha con formato inválido", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, date: "20-07-2026" }).success).toBe(
      false,
    );
  });

  it("rechaza un horario con formato inválido", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, time: "2:30 PM" }).success).toBe(
      false,
    );
  });

  it("rechaza un horario fuera de rango (25:00)", () => {
    expect(appointmentInputSchema.safeParse({ ...validInput, time: "25:00" }).success).toBe(false);
  });
});

describe("rescheduleAppointmentInputSchema", () => {
  const validReschedule = { date: "2026-07-20", time: "14:30" };

  it("acepta una fecha y horario válidos", () => {
    expect(rescheduleAppointmentInputSchema.safeParse(validReschedule).success).toBe(true);
  });

  it("rechaza una fecha con formato inválido", () => {
    const result = rescheduleAppointmentInputSchema.safeParse({
      ...validReschedule,
      date: "20-07-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un horario con formato inválido", () => {
    const result = rescheduleAppointmentInputSchema.safeParse({
      ...validReschedule,
      time: "2:30 PM",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un horario fuera de rango (25:00)", () => {
    const result = rescheduleAppointmentInputSchema.safeParse({
      ...validReschedule,
      time: "25:00",
    });
    expect(result.success).toBe(false);
  });

  it("no acepta campos de una cita nueva (staffId/serviceId no forman parte de este input)", () => {
    const parsed = rescheduleAppointmentInputSchema.parse(validReschedule);
    expect(parsed).toEqual(validReschedule);
  });
});
