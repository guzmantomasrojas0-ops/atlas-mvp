import type { AgentContext } from "./context";
import type { Intent } from "./intent";

/**
 * Lo que ATLAS tiene permitido hacer para un mensaje puntual. El Policy
 * Engine es la única fuente de verdad sobre esto — ni el Tool Registry ni
 * el Pipeline deciden políticas por su cuenta.
 */
export interface PolicyDecision {
  intent: Intent;
  canBook: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  requiresConfirmation: boolean;
  shouldEscalateToHuman: boolean;
  reason: string;
}

function decide(
  intent: Intent,
  overrides: Partial<Omit<PolicyDecision, "intent">>,
  reason: string,
): PolicyDecision {
  return {
    intent,
    canBook: false,
    canCancel: false,
    canReschedule: false,
    requiresConfirmation: false,
    shouldEscalateToHuman: false,
    reason,
    ...overrides,
  };
}

/**
 * Decide qué puede hacer ATLAS para un intent dado, en el contexto de un
 * negocio y cliente puntuales. Pura: sin IA, sin I/O — solo reglas.
 */
export function evaluatePolicy(intent: Intent, context: AgentContext): PolicyDecision {
  switch (intent) {
    case "REQUEST_HUMAN":
      return decide(
        intent,
        { shouldEscalateToHuman: true },
        "El cliente pidió hablar con una persona.",
      );

    case "BOOK_APPOINTMENT": {
      const canBook = context.services.length > 0 && context.staff.length > 0;
      return decide(
        intent,
        { canBook, requiresConfirmation: canBook },
        canBook
          ? "El negocio tiene servicios y equipo disponibles para reservar."
          : "El negocio todavía no tiene servicios o equipo cargados.",
      );
    }

    case "CANCEL_APPOINTMENT": {
      const canCancel = context.upcomingAppointments.length > 0;
      return decide(
        intent,
        { canCancel, requiresConfirmation: canCancel },
        canCancel
          ? "El cliente tiene una reserva próxima para cancelar."
          : "El cliente no tiene ninguna reserva próxima.",
      );
    }

    case "RESCHEDULE_APPOINTMENT": {
      const canReschedule = context.upcomingAppointments.length > 0;
      return decide(
        intent,
        { canReschedule, requiresConfirmation: canReschedule },
        canReschedule
          ? "El cliente tiene una reserva próxima para cambiar."
          : "El cliente no tiene ninguna reserva próxima.",
      );
    }

    case "CHECK_AVAILABILITY":
    case "ASK_HOURS":
    case "ASK_PRICE":
    case "GREETING":
    case "FAREWELL":
      return decide(intent, {}, "Consulta informativa, no requiere ninguna acción.");

    case "OTHER":
      return decide(
        intent,
        { shouldEscalateToHuman: true },
        "No se pudo clasificar el mensaje — ATLAS no debe adivinar.",
      );
  }
}
