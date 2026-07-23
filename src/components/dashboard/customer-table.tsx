import { UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CustomerListItem } from "@/modules/customer";

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function CustomerTable({ customers }: { customers: CustomerListItem[] }) {
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound className="h-5 w-5" />}
        title="Todavía no tenés clientes"
        description="Los clientes aparecen acá automáticamente en cuanto agendan su primera reserva o escriben por algún canal."
      />
    );
  }

  return (
    <Card className="shadow-floating overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Teléfono</th>
              <th className="px-6 py-3 font-medium">Reservas</th>
              <th className="px-6 py-3 font-medium">Última visita</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-muted/60 transition-colors duration-150">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar id={customer.id} name={customer.name} size="sm" />
                    <span className="text-foreground font-medium">{customer.name}</span>
                  </div>
                </td>
                <td className="text-muted-foreground px-6 py-3.5">{customer.phone ?? "—"}</td>
                <td className="text-muted-foreground px-6 py-3.5">{customer.appointmentCount}</td>
                <td className="text-muted-foreground px-6 py-3.5">
                  {customer.lastVisit ? dateFormatter.format(customer.lastVisit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
