import { toCustomerListItem, type CustomerListItem } from "./domain";
import { listClientsWithStats } from "./data";

export type { CustomerListItem };

/** Lista los clientes de un negocio para el Dashboard, más recientes primero. */
export async function listCustomers(businessId: string): Promise<CustomerListItem[]> {
  const clients = await listClientsWithStats(businessId);
  return clients.map(toCustomerListItem);
}
