import { describe, expect, it } from "vitest";
import { keywordIntentResolver } from "@/modules/agent/domain";

describe("keywordIntentResolver", () => {
  it.each([
    ["Hola, buenas tardes", "GREETING"],
    ["Buenos días!", "GREETING"],
    ["Muchas gracias, nos vemos", "FAREWELL"],
    ["Chau, hasta luego", "FAREWELL"],
    ["Quiero reservar un turno para el corte de pelo", "BOOK_APPOINTMENT"],
    ["Quiero agendar una cita", "BOOK_APPOINTMENT"],
    ["Necesito cancelar mi turno", "CANCEL_APPOINTMENT"],
    ["Quiero anular la reserva de mañana", "CANCEL_APPOINTMENT"],
    ["Quiero cambiar mi turno para otro día", "RESCHEDULE_APPOINTMENT"],
    ["¿Cuánto cuesta el corte de pelo?", "ASK_PRICE"],
    ["¿Cuál es el precio del servicio?", "ASK_PRICE"],
    ["¿A qué hora abren?", "ASK_HOURS"],
    ["¿Qué horario tienen los sábados?", "ASK_HOURS"],
    ["¿Qué horarios tienen mañana?", "CHECK_AVAILABILITY"],
    ["¿Tienen disponibilidad para el jueves?", "CHECK_AVAILABILITY"],
    ["¿Hay lugar hoy a la tarde?", "CHECK_AVAILABILITY"],
    ["¿Tienen turno para mañana?", "CHECK_AVAILABILITY"],
    ["Quiero hablar con un humano", "REQUEST_HUMAN"],
    ["Necesito hablar con una persona real", "REQUEST_HUMAN"],
    ["asdkjaslkdj random gibberish", "OTHER"],
    ["", "OTHER"],
  ] as const)("clasifica %j como %s", async (message, expected) => {
    await expect(keywordIntentResolver(message)).resolves.toBe(expected);
  });

  it("ignora mayúsculas y tildes", async () => {
    await expect(keywordIntentResolver("QUIERO CANCELAR MI CITA")).resolves.toBe(
      "CANCEL_APPOINTMENT",
    );
    await expect(keywordIntentResolver("cuánto vale el corte")).resolves.toBe("ASK_PRICE");
  });

  it("prioriza cancelar/cambiar sobre reservar cuando ambas palabras aparecen", async () => {
    await expect(keywordIntentResolver("quiero cambiar mi turno de mañana")).resolves.toBe(
      "RESCHEDULE_APPOINTMENT",
    );
    await expect(keywordIntentResolver("quiero cancelar mi turno de mañana")).resolves.toBe(
      "CANCEL_APPOINTMENT",
    );
  });

  it("distingue consultar disponibilidad de preguntar el horario de atención, aunque ambas digan 'horario'", async () => {
    // Plural + referencia temporal → está preguntando por un turno libre, no por el horario de atención.
    await expect(keywordIntentResolver("¿Qué horarios tienen mañana?")).resolves.toBe(
      "CHECK_AVAILABILITY",
    );
    // Singular, sin referencia a disponibilidad → pregunta por el horario de atención.
    await expect(keywordIntentResolver("¿Qué horario tienen los sábados?")).resolves.toBe(
      "ASK_HOURS",
    );
  });
});
