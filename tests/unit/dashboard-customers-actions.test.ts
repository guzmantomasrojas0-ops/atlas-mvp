import { beforeEach, describe, expect, it, vi } from "vitest";

// Mismo patrón que dashboard-appointments-actions.test.ts: se mockean los
// bordes del módulo (sesión actual, servicio de customer, cache de Next) para
// probar solo la lógica de la Server Action — el caso real contra Postgres ya
// lo cubre tests/integration/customer.test.ts.
const { requireSessionMock, updateCustomerMock, revalidatePathMock, FakeCustomerNotFoundError } =
  vi.hoisted(() => ({
    requireSessionMock: vi.fn(),
    updateCustomerMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    FakeCustomerNotFoundError: class extends Error {},
  }));

vi.mock("@/lib/session", () => ({ requireSession: requireSessionMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/modules/customer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/customer")>();
  return {
    ...actual,
    updateCustomer: updateCustomerMock,
    CustomerNotFoundError: FakeCustomerNotFoundError,
  };
});

import { updateCustomerAction } from "@/app/dashboard/customers/actions";

const FAKE_SESSION = {
  user: { id: "user-1", email: "ana@example.com", name: "Ana", role: "STAFF", businessId: "biz-1" },
  business: { id: "biz-1", name: "Barbería de prueba", timezone: "America/Bogota" },
};

describe("updateCustomerAction", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    updateCustomerMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("actualiza con éxito, delega en customer.updateCustomer y revalida las rutas de cliente", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    const updatedCustomer = { id: "c1", name: "Nombre nuevo", phone: "+57 300 000 0000" };
    updateCustomerMock.mockResolvedValue(updatedCustomer);

    const input = { name: "Nombre nuevo", phone: "+57 300 000 0000" };
    const result = await updateCustomerAction("c1", input);

    expect(result).toEqual({ success: true, customer: updatedCustomer });
    expect(updateCustomerMock).toHaveBeenCalledWith("biz-1", "c1", input);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/customers");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/customers/c1");
  });

  it("cualquier usuario autenticado puede editar (no exige un rol específico)", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    updateCustomerMock.mockResolvedValue({ id: "c1", name: "X", phone: null });

    const result = await updateCustomerAction("c1", { name: "X", phone: "" });

    expect(result.success).toBe(true);
  });

  it("propaga el mensaje de CustomerNotFoundError sin revalidar", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    updateCustomerMock.mockRejectedValue(new FakeCustomerNotFoundError("Ese cliente no existe."));

    const result = await updateCustomerAction("c-404", { name: "Nombre válido", phone: "" });

    expect(result).toEqual({ success: false, error: "Ese cliente no existe." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("cualquier otro error devuelve un mensaje genérico, sin filtrar el error interno", async () => {
    requireSessionMock.mockResolvedValue(FAKE_SESSION);
    updateCustomerMock.mockRejectedValue(new Error("conexión perdida con la base"));

    const result = await updateCustomerAction("c1", { name: "Nombre válido", phone: "" });

    expect(result).toEqual({
      success: false,
      error: "No se pudo actualizar el cliente. Intenta de nuevo.",
    });
  });
});
