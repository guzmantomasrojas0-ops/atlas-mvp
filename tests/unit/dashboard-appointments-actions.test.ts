import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` es hoisted por Vitest por encima de todos los imports — solo
// puede referenciar variables declaradas con `vi.hoisted`. Se mockean los
// bordes del módulo (sesión/negocio actual, scheduling, cache de Next) para
// poder probar la lógica de la Server Action en sí (qué mensaje devuelve,
// cuándo revalida) sin tocar una base real — ese caso ya lo cubre el test de
// integración.
const {
  requireSessionMock,
  cancelAppointmentMock,
  rescheduleAppointmentMock,
  revalidatePathMock,
  FakeForbiddenError,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  cancelAppointmentMock: vi.fn(),
  rescheduleAppointmentMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  FakeForbiddenError: class extends Error {},
}));

vi.mock("@/lib/session", () => ({
  requireSession: requireSessionMock,
  requireRole: vi.fn(),
  ForbiddenError: FakeForbiddenError,
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/modules/scheduling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/scheduling")>();
  return {
    ...actual,
    cancelAppointment: cancelAppointmentMock,
    rescheduleAppointment: rescheduleAppointmentMock,
  };
});

import {
  AppointmentNotFoundError,
  OutsideBusinessHoursError,
  SchedulingConflictError,
} from "@/modules/scheduling";
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
} from "@/app/dashboard/appointments/actions";

const FAKE_SESSION = {
  user: { id: "user-1", email: "ana@example.com", name: "Ana", role: "OWNER", businessId: "biz-1" },
  business: { id: "biz-1", name: "Barbería de prueba", timezone: "America/Bogota" },
};

describe("cancelAppointmentAction", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    cancelAppointmentMock.mockReset();
    rescheduleAppointmentMock.mockReset();
    revalidatePathMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cancela con éxito, delega en scheduling.cancelAppointment y revalida /dashboard/appointments", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    cancelAppointmentMock.mockResolvedValue(undefined);

    const result = await cancelAppointmentAction("apt-1");

    expect(result).toEqual({ success: true });
    expect(cancelAppointmentMock).toHaveBeenCalledWith("biz-1", "apt-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/appointments");
  });

  it("propaga el mensaje de AppointmentNotFoundError sin revalidar", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    cancelAppointmentMock.mockRejectedValue(new AppointmentNotFoundError());

    const result = await cancelAppointmentAction("apt-404");

    expect(result).toEqual({
      success: false,
      error: "Esa reserva no existe o ya no está confirmada.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("cualquier otro error devuelve un mensaje genérico, sin filtrar el error interno", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    cancelAppointmentMock.mockRejectedValue(new Error("conexión perdida con la base"));

    const result = await cancelAppointmentAction("apt-1");

    expect(result).toEqual({
      success: false,
      error: "No se pudo cancelar la reserva. Intenta de nuevo.",
    });
  });
});

describe("rescheduleAppointmentAction", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    rescheduleAppointmentMock.mockReset();
    revalidatePathMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const input = { date: "2026-07-25", time: "15:00" };

  it("reprograma con éxito, delega en scheduling.rescheduleAppointment, devuelve la cita actualizada y revalida /dashboard/appointments", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    const updatedAppointment = { id: "apt-1", startsAt: new Date("2026-07-25T20:00:00.000Z") };
    rescheduleAppointmentMock.mockResolvedValue(updatedAppointment);

    const result = await rescheduleAppointmentAction("apt-1", input);

    expect(result).toEqual({ success: true, appointment: updatedAppointment });
    expect(rescheduleAppointmentMock).toHaveBeenCalledWith(
      "biz-1",
      "America/Bogota",
      "apt-1",
      input,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/appointments");
  });

  it("propaga el mensaje de AppointmentNotFoundError sin revalidar", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    rescheduleAppointmentMock.mockRejectedValue(new AppointmentNotFoundError());

    const result = await rescheduleAppointmentAction("apt-404", input);

    expect(result).toEqual({
      success: false,
      error: "Esa reserva no existe o ya no está confirmada.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("propaga el mensaje de SchedulingConflictError sin revalidar", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    rescheduleAppointmentMock.mockRejectedValue(new SchedulingConflictError());

    const result = await rescheduleAppointmentAction("apt-1", input);

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("propaga el mensaje de OutsideBusinessHoursError sin revalidar", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    rescheduleAppointmentMock.mockRejectedValue(new OutsideBusinessHoursError());

    const result = await rescheduleAppointmentAction("apt-1", input);

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("cualquier otro error devuelve un mensaje genérico, sin filtrar el error interno", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    rescheduleAppointmentMock.mockRejectedValue(new Error("conexión perdida con la base"));

    const result = await rescheduleAppointmentAction("apt-1", input);

    expect(result).toEqual({
      success: false,
      error: "No se pudo reprogramar la reserva. Intenta de nuevo.",
    });
  });
});
