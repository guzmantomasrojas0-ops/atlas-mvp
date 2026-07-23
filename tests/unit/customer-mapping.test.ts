import { describe, expect, it } from "vitest";
import { toCustomerListItem } from "@/modules/customer/domain";

describe("toCustomerListItem", () => {
  it("mapea appointmentCount desde _count y lastVisit desde el primer appointment", () => {
    const result = toCustomerListItem({
      id: "c1",
      name: "María Gómez",
      phone: "+57 300 000 0000",
      appointments: [{ startsAt: new Date("2026-07-24T15:00:00Z") }],
      _count: { appointments: 5 },
    });

    expect(result).toEqual({
      id: "c1",
      name: "María Gómez",
      phone: "+57 300 000 0000",
      appointmentCount: 5,
      lastVisit: new Date("2026-07-24T15:00:00Z"),
    });
  });

  it("lastVisit es null si no hay ninguna reserva no cancelada (appointments ya viene filtrado así)", () => {
    const result = toCustomerListItem({
      id: "c2",
      name: "Cliente Nuevo",
      phone: null,
      appointments: [],
      _count: { appointments: 0 },
    });

    expect(result.lastVisit).toBeNull();
    expect(result.appointmentCount).toBe(0);
  });

  it("appointmentCount cuenta todas las reservas históricas, aunque lastVisit no encuentre ninguna vigente", () => {
    // Un cliente con 3 reservas, todas canceladas: _count las cuenta igual,
    // pero `appointments` (ya filtrado en el repositorio) llega vacío.
    const result = toCustomerListItem({
      id: "c3",
      name: "Cliente con canceladas",
      phone: null,
      appointments: [],
      _count: { appointments: 3 },
    });

    expect(result.appointmentCount).toBe(3);
    expect(result.lastVisit).toBeNull();
  });

  it("preserva phone null tal cual", () => {
    const result = toCustomerListItem({
      id: "c4",
      name: "Sin Teléfono",
      phone: null,
      appointments: [],
      _count: { appointments: 0 },
    });
    expect(result.phone).toBeNull();
  });
});
