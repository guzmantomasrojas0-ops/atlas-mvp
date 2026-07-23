import { describe, expect, it } from "vitest";
import { getBusinessHoursTool } from "@/modules/agent";

describe("getBusinessHoursTool", () => {
  it("no hace ninguna consulta — solo devuelve lo que ya se le pasó más la ventana horaria de referencia", async () => {
    const output = await getBusinessHoursTool.execute({
      businessName: "Barbería El Buen Corte",
      businessTimezone: "America/Bogota",
    });

    expect(output.businessName).toBe("Barbería El Buen Corte");
    expect(output.timezone).toBe("America/Bogota");
    expect(output.openHour).toBe(8);
    expect(output.closeHour).toBe(20);
    expect(output.note.length).toBeGreaterThan(0);
  });

  it("refleja el negocio que se le pase, no uno fijo", async () => {
    const output = await getBusinessHoursTool.execute({
      businessName: "Otro negocio",
      businessTimezone: "America/Mexico_City",
    });

    expect(output.businessName).toBe("Otro negocio");
    expect(output.timezone).toBe("America/Mexico_City");
  });
});
