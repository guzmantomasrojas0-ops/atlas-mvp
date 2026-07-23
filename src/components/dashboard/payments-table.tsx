import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { paymentMethodLabels, type PaymentListItem } from "@/modules/payments";

const amountFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_STYLES: Record<PaymentListItem["status"], string> = {
  CONFIRMED: "bg-emerald-500/10 text-emerald-400",
  REVERTED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<PaymentListItem["status"], string> = {
  CONFIRMED: "Confirmado",
  REVERTED: "Revertido",
};

export function PaymentsTable({ payments }: { payments: PaymentListItem[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="Todavía no registraste ningún pago"
        description="Los pagos confirmados por Zelle desde el detalle de una reserva van a aparecer acá."
      />
    );
  }

  return (
    <Card className="shadow-floating overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-6 py-3 font-medium">Cliente</th>
              <th className="px-6 py-3 font-medium">Servicio</th>
              <th className="px-6 py-3 font-medium">Monto</th>
              <th className="px-6 py-3 font-medium">Método</th>
              <th className="px-6 py-3 font-medium">Estado</th>
              <th className="px-6 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-muted/60 transition-colors duration-150">
                <td className="text-foreground px-6 py-3.5 font-medium">{payment.clientName}</td>
                <td className="text-muted-foreground px-6 py-3.5">{payment.serviceName}</td>
                <td className="text-foreground px-6 py-3.5 font-medium">
                  {payment.currency} {amountFormatter.format(payment.amount)}
                </td>
                <td className="text-muted-foreground px-6 py-3.5">
                  {paymentMethodLabels[payment.method]}
                </td>
                <td className="px-6 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[payment.status],
                    )}
                  >
                    {STATUS_LABELS[payment.status]}
                  </span>
                </td>
                <td className="text-muted-foreground px-6 py-3.5">
                  {dateFormatter.format(payment.confirmedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
