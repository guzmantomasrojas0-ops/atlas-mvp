import { describe, expect, it } from "vitest";
import { createAppointmentTool } from "@/modules/agent";

describe("createAppointmentTool", () => {
  it("declara su nombre — la lógica real (validación + creación) se testea con Postgres real", () => {
    expect(createAppointmentTool.name).toBe("CREATE_APPOINTMENT");
    expect(typeof createAppointmentTool.execute).toBe("function");
  });

  it("se marca a sí misma como requiresConfirmation — el modelo no debe llamarla sin que el cliente confirme antes", () => {
    expect(createAppointmentTool.requiresConfirmation).toBe(true);
  });

  it("su inputSchema exige serviceId, staffId, date y time", () => {
    const result = createAppointmentTool.inputSchema.safeParse({
      businessId: "biz-1",
      businessTimezone: "America/Bogota",
      clientId: "client-1",
    });
    expect(result.success).toBe(false);
  });

  it("su inputSchema rechaza una fecha u hora con formato inválido", () => {
    const base = {
      businessId: "biz-1",
      businessTimezone: "America/Bogota",
      clientId: "client-1",
      serviceId: "s1",
      staffId: "st1",
    };
    expect(
      createAppointmentTool.inputSchema.safeParse({ ...base, date: "21/07/2026", time: "14:00" })
        .success,
    ).toBe(false);
    expect(
      createAppointmentTool.inputSchema.safeParse({ ...base, date: "2026-07-21", time: "2pm" })
        .success,
    ).toBe(false);
  });

  it("su inputSchema acepta un input completo y bien formado", () => {
    const result = createAppointmentTool.inputSchema.safeParse({
      businessId: "biz-1",
      businessTimezone: "America/Bogota",
      clientId: "client-1",
      serviceId: "s1",
      staffId: "st1",
      date: "2026-07-21",
      time: "14:00",
    });
    expect(result.success).toBe(true);
  });
});
