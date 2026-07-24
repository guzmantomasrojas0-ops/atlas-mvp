import { es } from "date-fns/locale";
import { CalendarClock, MessagesSquare, Wallet } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditCustomerForm } from "@/components/dashboard/edit-customer-form";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { channelLabels, type ConversationListItem } from "@/modules/conversation";
import type { CustomerDetail } from "@/modules/customer";
import { paymentMethodLabels, type PaymentListItem } from "@/modules/payments";
import { formatInBusinessTimezone } from "@/modules/scheduling/domain";

const PAYMENT_STATUS_STYLES: Record<PaymentListItem["status"], string> = {
  CONFIRMED: "bg-emerald-500/10 text-emerald-400",
  REVERTED: "bg-muted text-muted-foreground",
};
const PAYMENT_STATUS_LABELS: Record<PaymentListItem["status"], string> = {
  CONFIRMED: "Confirmado",
  REVERTED: "Revertido",
};

const amountFormatter = new Intl.NumberFormat("es", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

interface CustomerDetailViewProps {
  customer: CustomerDetail;
  timezone: string;
}

export function CustomerDetailView({ customer, timezone }: CustomerDetailViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar id={customer.id} name={customer.name} size="lg" />
        <div>
          <h1 className="text-foreground text-xl font-semibold">{customer.name}</h1>
          <p className="text-muted-foreground text-sm">
            Cliente desde{" "}
            {formatInBusinessTimezone(customer.createdAt, timezone, "MMMM 'de' yyyy", {
              locale: es,
            })}
          </p>
        </div>
      </div>

      <Card className="p-6">
        <CardTitle className="mb-4 text-sm">Editar datos de contacto</CardTitle>
        <EditCustomerForm customerId={customer.id} name={customer.name} phone={customer.phone} />
      </Card>

      <Card className="shadow-floating">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <CalendarClock className="text-muted-foreground h-4 w-4" aria-hidden />
          <CardTitle className="text-base">Historial de reservas</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no tiene reservas.</p>
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {customer.appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-foreground text-sm font-medium">{appointment.serviceName}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatInBusinessTimezone(
                        appointment.startsAt,
                        timezone,
                        "d 'de' MMMM 'de' yyyy, HH:mm",
                        { locale: es },
                      )}{" "}
                      · {appointment.staffName}
                    </p>
                  </div>
                  <Badge
                    className={
                      appointment.paymentStatus === "PAID"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }
                  >
                    {appointment.paymentStatus === "PAID" ? "Pagado" : "Pago pendiente"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-floating">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <Wallet className="text-muted-foreground h-4 w-4" aria-hidden />
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no registró ningún pago.</p>
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {customer.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {payment.currency} {amountFormatter.format(payment.amount)} ·{" "}
                      {payment.serviceName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {paymentMethodLabels[payment.method]} ·{" "}
                      {dateFormatter.format(payment.confirmedAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      PAYMENT_STATUS_STYLES[payment.status],
                    )}
                  >
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-floating">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <MessagesSquare className="text-muted-foreground h-4 w-4" aria-hidden />
          <CardTitle className="text-base">Conversaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.conversations.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare className="h-5 w-5" />}
              title="Todavía no hay conversaciones"
              description="Cuando este cliente escriba por algún canal, la conversación va a aparecer acá."
            />
          ) : (
            <ConversationLinks conversations={customer.conversations} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConversationLinks({ conversations }: { conversations: ConversationListItem[] }) {
  return (
    <ul className="divide-border flex flex-col divide-y">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link
            href={`/dashboard/conversations/${conversation.id}`}
            className="ring-offset-background focus-visible:ring-brand-600 hover:bg-muted -mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-3 transition-colors duration-150 outline-none first:pt-3 last:pb-3 focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">
                {conversation.lastMessagePreview ?? "Sin mensajes todavía"}
              </p>
              <p className="text-muted-foreground text-xs">{channelLabels[conversation.channel]}</p>
            </div>
            {conversation.unread && <Badge className="bg-brand-500/10 text-brand-400">Nuevo</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
