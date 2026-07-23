import type { Intent } from "./intent";
import { normalizeText } from "./text-match";

/**
 * Clasifica un mensaje en una `Intent`. Es una interfaz, no una clase: un
 * resolver es cualquier función con esta firma — hoy una basada en reglas,
 * desde el Sprint 11 también una respaldada por un modelo real de IA (ver
 * `agent/ai-intent-resolver.ts`). ATLAS no depende de cuál. Async siempre
 * — un resolver real hace una llamada de red, así que no tendría sentido
 * que el tipo fuera sincrónico solo porque el de reglas lo es.
 */
export type IntentResolver = (message: string) => Promise<Intent>;

interface KeywordRule {
  intent: Intent;
  keywords: string[];
}

// Orden importa: la primera regla que matchea gana.
// - Cancelar/cambiar van antes que reservar porque frases como "quiero
//   cambiar mi turno" contienen también palabras de reserva ("turno").
// - Consultar disponibilidad va antes que preguntar horario porque ambas
//   comparten la palabra "horario" ("¿qué horarios tienen mañana?" es
//   disponibilidad, no el horario de atención) — la frase más específica
//   se revisa primero.
const RULES: KeywordRule[] = [
  {
    intent: "REQUEST_HUMAN",
    keywords: ["humano", "persona real", "hablar con alguien", "agente humano"],
  },
  { intent: "CANCEL_APPOINTMENT", keywords: ["cancelar", "anular"] },
  {
    intent: "RESCHEDULE_APPOINTMENT",
    keywords: [
      "cambiar",
      "reprogramar",
      "mover el turno",
      "mover la cita",
      "otro día",
      "otro horario",
    ],
  },
  {
    intent: "CHECK_AVAILABILITY",
    keywords: [
      "disponibilidad",
      "disponible",
      "horarios tienen",
      "horarios libres",
      "horarios disponibles",
      "hay lugar",
      "tienen turno",
      "hay turno",
    ],
  },
  { intent: "ASK_PRICE", keywords: ["precio", "cuánto cuesta", "cuanto cuesta", "vale", "cuesta"] },
  { intent: "ASK_HOURS", keywords: ["horario", "atienden", "abren", "cierran", "a qué hora"] },
  {
    intent: "BOOK_APPOINTMENT",
    keywords: [
      "reservar",
      "agendar",
      "sacar turno",
      "sacar un turno",
      "turno",
      "cita",
      "appointment",
    ],
  },
  {
    intent: "GREETING",
    keywords: ["hola", "buenas", "buen día", "buenos días", "buenas tardes", "buenas noches"],
  },
  {
    intent: "FAREWELL",
    keywords: ["gracias", "chau", "adiós", "adios", "nos vemos", "hasta luego"],
  },
];

/**
 * Resolver por reglas (no IA): matchea palabras clave sobre el mensaje
 * normalizado. Sirve para tener el pipeline corriendo de punta a punta hoy;
 * un resolver real (IA) implementa el mismo `IntentResolver` y lo reemplaza
 * sin tocar el resto del motor.
 */
export const keywordIntentResolver: IntentResolver = async (message) => {
  const normalized = normalizeText(message);
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return rule.intent;
    }
  }
  return "OTHER";
};
