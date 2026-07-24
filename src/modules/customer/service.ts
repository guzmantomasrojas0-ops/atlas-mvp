import type { ConversationListItem } from "@/modules/conversation";
import { listConversationsForClient } from "@/modules/conversation";
import type { PaymentListItem } from "@/modules/payments";
import { listPaymentsForClient } from "@/modules/payments";
import type { AppointmentListItem } from "@/modules/scheduling";
import { getAppointmentsByClient } from "@/modules/scheduling";
import {
  customerInputSchema,
  CustomerNotFoundError,
  toCustomerListItem,
  type CustomerInput,
  type CustomerListItem,
} from "./domain";
import { findClientWithStatsById, listClientsWithStats, updateClient } from "./data";

export type { CustomerListItem };

export interface CustomerDetail extends CustomerListItem {
  createdAt: Date;
  appointments: AppointmentListItem[];
  payments: PaymentListItem[];
  conversations: ConversationListItem[];
}

/** Lista los clientes de un negocio para el Dashboard, más recientes primero. */
export async function listCustomers(businessId: string): Promise<CustomerListItem[]> {
  const clients = await listClientsWithStats(businessId);
  return clients.map(toCustomerListItem);
}

/**
 * Ficha completa de un cliente: sus datos, más el historial de reservas,
 * pagos y conversaciones — cada uno reutilizando el módulo dueño de esos
 * datos (Scheduling, Payments, Conversation) en vez de duplicar la consulta
 * acá. `null` si no existe o es de otro negocio.
 */
export async function getCustomerDetail(
  businessId: string,
  id: string,
): Promise<CustomerDetail | null> {
  const client = await findClientWithStatsById(businessId, id);
  if (!client) return null;

  const [appointments, payments, conversations] = await Promise.all([
    getAppointmentsByClient(businessId, id),
    listPaymentsForClient(businessId, id),
    listConversationsForClient(businessId, id),
  ]);

  return {
    ...toCustomerListItem(client),
    createdAt: client.createdAt,
    appointments,
    payments,
    conversations,
  };
}

/** Actualiza nombre/teléfono de un cliente existente. */
export async function updateCustomer(
  businessId: string,
  id: string,
  input: CustomerInput,
): Promise<CustomerListItem> {
  const data = customerInputSchema.parse(input);
  const { count } = await updateClient(businessId, id, data);
  if (count === 0) throw new CustomerNotFoundError();

  const updated = await findClientWithStatsById(businessId, id);
  if (!updated) throw new CustomerNotFoundError();
  return toCustomerListItem(updated);
}
