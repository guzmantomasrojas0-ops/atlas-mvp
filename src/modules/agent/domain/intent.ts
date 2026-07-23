/**
 * Lo que el cliente está tratando de hacer. Es el primer paso del pipeline
 * del agente — todavía no involucra IA, solo la clasificación estructurada
 * sobre la que cualquier resolver (por reglas o por IA) puede trabajar.
 */
export const INTENTS = [
  "BOOK_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CHECK_AVAILABILITY",
  "ASK_HOURS",
  "ASK_PRICE",
  "REQUEST_HUMAN",
  "GREETING",
  "FAREWELL",
  "OTHER",
] as const;

export type Intent = (typeof INTENTS)[number];

export const intentLabels: Record<Intent, string> = {
  BOOK_APPOINTMENT: "Reservar cita",
  CANCEL_APPOINTMENT: "Cancelar cita",
  RESCHEDULE_APPOINTMENT: "Cambiar cita",
  CHECK_AVAILABILITY: "Consultar disponibilidad",
  ASK_HOURS: "Preguntar horario",
  ASK_PRICE: "Preguntar precio",
  REQUEST_HUMAN: "Hablar con humano",
  GREETING: "Saludo",
  FAREWELL: "Despedida",
  OTHER: "Otro",
};
