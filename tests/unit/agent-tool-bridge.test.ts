import { describe, expect, it } from "vitest";
import {
  applyToolContextDefaults,
  buildToolDefinitions,
  toolToDefinition,
  type AgentContext,
} from "@/modules/agent/domain";
import {
  createAppointmentTool,
  findServiceTool,
  getBusinessHoursTool,
  getUpcomingAppointmentsTool,
  searchAvailabilityTool,
} from "@/modules/agent/tools";

function context(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    businessId: "biz-1",
    businessName: "Barbería El Buen Corte",
    businessTimezone: "America/Bogota",
    conversationId: "conv-1",
    clientId: "client-1",
    clientName: "María Gómez",
    services: [],
    staff: [],
    upcomingAppointments: [],
    pastAppointments: [],
    recentMessages: [],
    ...overrides,
  };
}

describe("toolToDefinition", () => {
  it("oculta los campos que el sistema inyecta, sin dejarlos ni en properties ni en required", () => {
    const definition = toolToDefinition(searchAvailabilityTool);
    const parameters = definition.parameters as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(parameters.properties).not.toHaveProperty("businessId");
    expect(parameters.properties).not.toHaveProperty("businessTimezone");
    expect(parameters.required).not.toContain("businessId");
    expect(parameters.required).not.toContain("businessTimezone");
  });

  it("deja los campos que sí le corresponden decidir al modelo", () => {
    const definition = toolToDefinition(searchAvailabilityTool);
    const parameters = definition.parameters as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(parameters.properties).toHaveProperty("date");
    expect(parameters.properties).toHaveProperty("serviceDurationMinutes");
    expect(parameters.properties).toHaveProperty("staffId");
    expect(parameters.required).toEqual(["date", "serviceDurationMinutes"]);
  });

  it("una tool con todos sus campos ocultos queda con parámetros vacíos, no rota", () => {
    const definition = toolToDefinition(getBusinessHoursTool);
    const parameters = definition.parameters as {
      properties: Record<string, unknown>;
      required?: string[];
    };

    expect(parameters.properties).toEqual({});
    expect(parameters.required ?? []).toEqual([]);
  });

  it("no revienta con un campo Date no representable en JSON Schema (now, oculto de todas formas)", () => {
    const definition = toolToDefinition(getUpcomingAppointmentsTool);
    const parameters = definition.parameters as { properties: Record<string, unknown> };

    expect(parameters.properties).not.toHaveProperty("now");
    expect(parameters.properties).not.toHaveProperty("businessId");
    expect(parameters.properties).not.toHaveProperty("clientId");
  });

  it("conserva name y description tal cual los declara la Tool", () => {
    const definition = toolToDefinition(findServiceTool);
    expect(definition.name).toBe("FIND_SERVICE");
    expect(definition.description).toBe(findServiceTool.description);
  });

  it("una tool sin requiresConfirmation no le agrega nada a la descripción", () => {
    const definition = toolToDefinition(searchAvailabilityTool);
    expect(definition.description).toBe(searchAvailabilityTool.description);
  });

  it("una tool con requiresConfirmation agrega el recordatorio de confirmación a la descripción", () => {
    const definition = toolToDefinition(createAppointmentTool);
    expect(definition.description.startsWith(createAppointmentTool.description)).toBe(true);
    expect(definition.description.toLowerCase()).toContain("modifica datos reales");
    expect(definition.description.toLowerCase()).toContain("confirmado explícitamente");
  });

  it("oculta businessId/businessTimezone/clientId para CREATE_APPOINTMENT", () => {
    const definition = toolToDefinition(createAppointmentTool);
    const parameters = definition.parameters as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(parameters.properties).not.toHaveProperty("businessId");
    expect(parameters.properties).not.toHaveProperty("businessTimezone");
    expect(parameters.properties).not.toHaveProperty("clientId");
    expect(parameters.properties).toHaveProperty("serviceId");
    expect(parameters.properties).toHaveProperty("staffId");
    expect(parameters.properties).toHaveProperty("date");
    expect(parameters.properties).toHaveProperty("time");
    expect(parameters.required.sort()).toEqual(["date", "serviceId", "staffId", "time"]);
  });
});

describe("buildToolDefinitions", () => {
  it("mapea una lista de Tools a ToolDefinitions, una por una", () => {
    const definitions = buildToolDefinitions([searchAvailabilityTool, findServiceTool]);
    expect(definitions.map((d) => d.name)).toEqual(["SEARCH_AVAILABILITY", "FIND_SERVICE"]);
  });
});

describe("applyToolContextDefaults", () => {
  it("inyecta businessId desde el contexto para una tool conocida", () => {
    const input = applyToolContextDefaults("FIND_SERVICE", { query: "corte" }, context());
    expect(input).toEqual({ query: "corte", businessId: "biz-1" });
  });

  it("el contexto siempre gana, aunque el modelo haya mandado su propio valor para ese campo", () => {
    const input = applyToolContextDefaults(
      "FIND_SERVICE",
      { query: "corte", businessId: "algo-inventado-por-el-modelo" },
      context(),
    );
    expect(input).toMatchObject({ businessId: "biz-1" });
  });

  it("una tool sin defaults de contexto declarados devuelve el input del modelo sin tocar", () => {
    const input = applyToolContextDefaults("GET_STAFF_INEXISTENTE", { query: "algo" }, context());
    expect(input).toEqual({ query: "algo" });
  });

  it("para GET_BUSINESS_HOURS inyecta ambos campos, aunque el modelo no haya mandado nada", () => {
    const input = applyToolContextDefaults("GET_BUSINESS_HOURS", {}, context());
    expect(input).toEqual({
      businessName: "Barbería El Buen Corte",
      businessTimezone: "America/Bogota",
    });
  });

  it("para CREATE_APPOINTMENT inyecta businessId/businessTimezone/clientId, ganándole a cualquier valor del modelo", () => {
    const input = applyToolContextDefaults(
      "CREATE_APPOINTMENT",
      {
        serviceId: "s1",
        staffId: "st1",
        date: "2026-07-21",
        time: "14:00",
        clientId: "otro-cliente",
      },
      context(),
    );
    expect(input).toEqual({
      serviceId: "s1",
      staffId: "st1",
      date: "2026-07-21",
      time: "14:00",
      businessId: "biz-1",
      businessTimezone: "America/Bogota",
      clientId: "client-1",
    });
  });
});
