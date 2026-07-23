import { es } from "date-fns/locale";
import { CalendarClock, MessagesSquare, Phone, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConversationDetail } from "@/modules/conversation";
import type { AppointmentListItem } from "@/modules/scheduling";
import { formatInBusinessTimezone } from "@/modules/scheduling/domain";

interface ClientContextPanelProps {
  conversation: ConversationDetail;
  timezone: string;
  appointments: AppointmentListItem[];
  conversationCount: number;
}

export function ClientContextPanel({
  conversation,
  timezone,
  appointments,
  conversationCount,
}: ClientContextPanelProps) {
  const now = new Date();
  const upcoming = [...appointments]
    .filter((appointment) => appointment.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = appointments.filter((appointment) => appointment.startsAt <= now);
  const usedServices = Array.from(new Set(past.map((appointment) => appointment.serviceName)));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <Avatar id={conversation.clientId} name={conversation.clientName} size="lg" />
        <div>
          <p className="text-foreground text-sm font-semibold">{conversation.clientName}</p>
          {conversation.clientPhone && (
            <p className="text-muted-foreground mt-0.5 flex items-center justify-center gap-1 text-xs">
              <Phone className="h-3 w-3" aria-hidden />
              {conversation.clientPhone}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Próximas reservas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-xs">No tiene reservas próximas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="bg-muted rounded-lg px-3 py-2">
                  <p className="text-foreground text-xs font-medium">{appointment.serviceName}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {formatInBusinessTimezone(
                      appointment.startsAt,
                      timezone,
                      "d 'de' MMMM, HH:mm",
                      {
                        locale: es,
                      },
                    )}{" "}
                    · {appointment.staffName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Servicios utilizados</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {usedServices.length === 0 ? (
            <p className="text-muted-foreground text-xs">Todavía no usó ningún servicio.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {usedServices.map((name) => (
                <Badge key={name}>{name}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Actividad</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-0">
          <InfoLine
            icon={MessagesSquare}
            label={`${conversationCount} conversación${conversationCount === 1 ? "" : "es"}`}
          />
          <InfoLine
            icon={Sparkles}
            label={`${appointments.length} reserva${appointments.length === 1 ? "" : "s"} en total`}
          />
          <InfoLine
            icon={CalendarClock}
            label={`Cliente desde ${formatInBusinessTimezone(conversation.clientSince, timezone, "MMMM 'de' yyyy", { locale: es })}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoLine({ icon: Icon, label }: { icon: typeof Phone; label: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-xs">
      <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </p>
  );
}
