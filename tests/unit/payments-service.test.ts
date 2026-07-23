import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` es hoisted por Vitest por encima de todos los imports — solo
// puede referenciar variables declaradas con `vi.hoisted`. Se mockea la capa
// de datos (`payments/data`) para poder probar acá, en aislamiento, la
// lógica de validación real que exige el brief (cita cancelada, pago ya
// activo, cita inexistente) — el caso contra Postgres real vive en el test
// de integración.
const {
  findAppointmentForPaymentMock,
  findActivePaymentMock,
  createPaymentAndMarkPaidMock,
  revertPaymentAndMarkPendingMock,
  listPaymentsByBusinessMock,
} = vi.hoisted(() => ({
  findAppointmentForPaymentMock: vi.fn(),
  findActivePaymentMock: vi.fn(),
  createPaymentAndMarkPaidMock: vi.fn(),
  revertPaymentAndMarkPendingMock: vi.fn(),
  listPaymentsByBusinessMock: vi.fn(),
}));

vi.mock("@/modules/payments/data", () => ({
  findAppointmentForPayment: findAppointmentForPaymentMock,
  findActivePayment: findActivePaymentMock,
  createPaymentAndMarkPaid: createPaymentAndMarkPaidMock,
  revertPaymentAndMarkPending: revertPaymentAndMarkPendingMock,
  listPaymentsByBusiness: listPaymentsByBusinessMock,
}));

import {
  AppointmentCancelledForPaymentError,
  NoActivePaymentError,
  PaymentAlreadyConfirmedError,
  PaymentAppointmentNotFoundError,
} from "@/modules/payments";
import {
  confirmPayment,
  getAppointmentPayment,
  listPayments,
  revertPayment,
} from "@/modules/payments/service";

const BUSINESS_ID = "biz-1";
const APPOINTMENT_ID = "apt-1";

function fakeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT_ID,
    businessId: BUSINESS_ID,
    status: "CONFIRMED",
    paymentStatus: "PENDING",
    client: { name: "María Gómez" },
    service: { name: "Corte de pelo" },
    ...overrides,
  };
}

function fakePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    appointmentId: APPOINTMENT_ID,
    amount: { toNumber: () => 25000 },
    currency: "USD",
    method: "ZELLE",
    status: "CONFIRMED",
    notes: null,
    confirmedBy: "Ana",
    createdAt: new Date("2026-07-20T10:00:00Z"),
    confirmedAt: new Date("2026-07-20T10:00:00Z"),
    ...overrides,
  };
}

const VALID_INPUT = {
  amount: 25000,
  currency: "USD",
  method: "ZELLE" as const,
  confirmedBy: "Ana",
};

beforeEach(() => {
  findAppointmentForPaymentMock.mockReset();
  findActivePaymentMock.mockReset();
  createPaymentAndMarkPaidMock.mockReset();
  revertPaymentAndMarkPendingMock.mockReset();
  listPaymentsByBusinessMock.mockReset();
});

describe("confirmPayment", () => {
  it("tira PaymentAppointmentNotFoundError si la cita no existe (o es de otro negocio)", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(null);

    await expect(confirmPayment(BUSINESS_ID, APPOINTMENT_ID, VALID_INPUT)).rejects.toThrow(
      PaymentAppointmentNotFoundError,
    );
    expect(createPaymentAndMarkPaidMock).not.toHaveBeenCalled();
  });

  it("tira AppointmentCancelledForPaymentError si la cita está cancelada", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment({ status: "CANCELLED" }));

    await expect(confirmPayment(BUSINESS_ID, APPOINTMENT_ID, VALID_INPUT)).rejects.toThrow(
      AppointmentCancelledForPaymentError,
    );
    expect(createPaymentAndMarkPaidMock).not.toHaveBeenCalled();
  });

  it("tira PaymentAlreadyConfirmedError si la cita ya está pagada (no dos pagos activos)", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment({ paymentStatus: "PAID" }));

    await expect(confirmPayment(BUSINESS_ID, APPOINTMENT_ID, VALID_INPUT)).rejects.toThrow(
      PaymentAlreadyConfirmedError,
    );
    expect(createPaymentAndMarkPaidMock).not.toHaveBeenCalled();
  });

  it("rechaza un monto inválido antes de tocar la base", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment());

    await expect(
      confirmPayment(BUSINESS_ID, APPOINTMENT_ID, { ...VALID_INPUT, amount: -5 }),
    ).rejects.toThrow();
    expect(createPaymentAndMarkPaidMock).not.toHaveBeenCalled();
  });

  it("crea el pago y devuelve el PaymentListItem mapeado, si todo es válido", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment());
    createPaymentAndMarkPaidMock.mockResolvedValue(fakePayment());

    const result = await confirmPayment(BUSINESS_ID, APPOINTMENT_ID, VALID_INPUT);

    expect(createPaymentAndMarkPaidMock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: BUSINESS_ID,
        appointmentId: APPOINTMENT_ID,
        amount: 25000,
        currency: "USD",
        method: "ZELLE",
        confirmedBy: "Ana",
      }),
    );
    expect(result).toMatchObject({
      id: "pay-1",
      clientName: "María Gómez",
      serviceName: "Corte de pelo",
      amount: 25000,
      status: "CONFIRMED",
    });
  });
});

describe("revertPayment", () => {
  it("tira PaymentAppointmentNotFoundError si la cita no existe", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(null);

    await expect(revertPayment(BUSINESS_ID, APPOINTMENT_ID)).rejects.toThrow(
      PaymentAppointmentNotFoundError,
    );
    expect(revertPaymentAndMarkPendingMock).not.toHaveBeenCalled();
  });

  it("tira NoActivePaymentError si no hay ningún pago activo para revertir", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment());
    findActivePaymentMock.mockResolvedValue(null);

    await expect(revertPayment(BUSINESS_ID, APPOINTMENT_ID)).rejects.toThrow(NoActivePaymentError);
    expect(revertPaymentAndMarkPendingMock).not.toHaveBeenCalled();
  });

  it("revierte el pago activo encontrado", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment({ paymentStatus: "PAID" }));
    findActivePaymentMock.mockResolvedValue(fakePayment());

    await revertPayment(BUSINESS_ID, APPOINTMENT_ID);

    expect(revertPaymentAndMarkPendingMock).toHaveBeenCalledWith("pay-1", APPOINTMENT_ID);
  });
});

describe("getAppointmentPayment", () => {
  it("devuelve null si la cita no existe", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(null);
    expect(await getAppointmentPayment(BUSINESS_ID, APPOINTMENT_ID)).toBeNull();
  });

  it("devuelve null si no hay ningún pago activo", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment());
    findActivePaymentMock.mockResolvedValue(null);
    expect(await getAppointmentPayment(BUSINESS_ID, APPOINTMENT_ID)).toBeNull();
  });

  it("devuelve el pago activo mapeado, si existe", async () => {
    findAppointmentForPaymentMock.mockResolvedValue(fakeAppointment({ paymentStatus: "PAID" }));
    findActivePaymentMock.mockResolvedValue(fakePayment());

    const result = await getAppointmentPayment(BUSINESS_ID, APPOINTMENT_ID);
    expect(result).toMatchObject({ id: "pay-1", clientName: "María Gómez" });
  });
});

describe("listPayments", () => {
  it("mapea cada fila cruda a un PaymentListItem", async () => {
    listPaymentsByBusinessMock.mockResolvedValue([
      { ...fakePayment(), appointment: fakeAppointment() },
      { ...fakePayment({ id: "pay-2", status: "REVERTED" }), appointment: fakeAppointment() },
    ]);

    const result = await listPayments(BUSINESS_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "pay-1", status: "CONFIRMED" });
    expect(result[1]).toMatchObject({ id: "pay-2", status: "REVERTED" });
  });
});
