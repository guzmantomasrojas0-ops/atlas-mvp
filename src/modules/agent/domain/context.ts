/**
 * Formas de datos propias del agente — deliberadamente desacopladas de los
 * tipos de otros módulos (`ServiceListItem`, `AppointmentListItem`, etc.).
 * Si el tipo de catálogo cambia de forma, solo `data/context-source.ts`
 * necesita ajustarse; la lógica de dominio del agente no se entera.
 */
export interface ServiceSummary {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface StaffSummary {
  id: string;
  name: string;
  role: string;
}

export interface AppointmentSummary {
  id: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
}

export interface MessageSummary {
  sender: "CLIENT" | "STAFF" | "AGENT";
  content: string;
  createdAt: Date;
}

/** Lo que `data/context-source.ts` reúne de otros módulos, sin procesar. */
export interface RawAgentContextInputs {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  conversationId: string;
  clientId: string;
  clientName: string;
  services: ServiceSummary[];
  staff: StaffSummary[];
  /** Todas las citas confirmadas del cliente, sin dividir por pasado/futuro. */
  appointments: AppointmentSummary[];
  recentMessages: MessageSummary[];
}

/** El contexto ya procesado que consumen Policy Engine y Pipeline. */
export interface AgentContext {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  conversationId: string;
  clientId: string;
  clientName: string;
  services: ServiceSummary[];
  staff: StaffSummary[];
  upcomingAppointments: AppointmentSummary[];
  pastAppointments: AppointmentSummary[];
  recentMessages: MessageSummary[];
}

/**
 * Convierte los datos crudos en el contexto que consume el resto del motor.
 * Pura y determinística: recibe `now` en vez de leer el reloj, así los tests
 * no dependen de la hora real.
 */
export function buildAgentContext(raw: RawAgentContextInputs, now: Date): AgentContext {
  const upcomingAppointments = raw.appointments
    .filter((appointment) => appointment.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const pastAppointments = raw.appointments
    .filter((appointment) => appointment.startsAt <= now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return {
    businessId: raw.businessId,
    businessName: raw.businessName,
    businessTimezone: raw.businessTimezone,
    conversationId: raw.conversationId,
    clientId: raw.clientId,
    clientName: raw.clientName,
    services: raw.services,
    staff: raw.staff,
    upcomingAppointments,
    pastAppointments,
    recentMessages: raw.recentMessages,
  };
}
