import { es } from "date-fns/locale";
import {
  CalendarCheck,
  CalendarClock,
  MessageSquare,
  Package,
  UsersRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-overview-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentBusiness } from "@/lib/session";
import { listServices, listStaffMembers } from "@/modules/catalog";
import { listConversations } from "@/modules/conversation";
import { listCustomers } from "@/modules/customer";
import { listAppointments } from "@/modules/scheduling";
import {
  addDays,
  formatInBusinessTimezone,
  getCalendarRange,
  todayInTimezone,
} from "@/modules/scheduling/domain";

// Depende de estado real de la base (conversaciones, reservas, clientes) —
// no debe quedar congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" description="Un resumen de la actividad de tu negocio.">
      <Suspense fallback={<DashboardOverviewSkeleton />}>
        <DashboardOverviewContent />
      </Suspense>
    </AppShell>
  );
}

async function DashboardOverviewContent() {
  const business = await getCurrentBusiness();

  const todayDate = todayInTimezone(business.timezone);
  const tomorrowDate = addDays(todayDate, 1);
  const todayRange = getCalendarRange("day", todayDate, business.timezone);
  const tomorrowRange = getCalendarRange("day", tomorrowDate, business.timezone);

  const [
    conversations,
    todayAppointments,
    tomorrowAppointments,
    customers,
    services,
    staffMembers,
  ] = await Promise.all([
    listConversations(business.id),
    listAppointments(business.id, todayRange.rangeStart, todayRange.rangeEnd),
    listAppointments(business.id, tomorrowRange.rangeStart, tomorrowRange.rangeEnd),
    listCustomers(business.id),
    listServices(business.id),
    listStaffMembers(business.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Conversaciones activas"
          value={conversations.length}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          label="Reservas de hoy"
          value={todayAppointments.length}
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <MetricCard
          label="Reservas de mañana"
          value={tomorrowAppointments.length}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <MetricCard
          label="Clientes totales"
          value={customers.length}
          icon={<UsersRound className="h-4 w-4" />}
        />
        <MetricCard
          label="Servicios"
          value={services.length}
          icon={<Package className="h-4 w-4" />}
        />
        <MetricCard
          label="Staff"
          value={staffMembers.length}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Reservas de hoy"
          action={
            <Link
              href="/dashboard/appointments"
              className="text-brand-700 text-xs font-medium hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          {todayAppointments.length === 0 ? (
            <EmptyState
              title="No hay reservas para hoy"
              className="border-0 bg-transparent p-0 py-8"
            />
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {todayAppointments.slice(0, 5).map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate font-medium">{appointment.clientName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {appointment.serviceName} · {appointment.staffName}
                    </p>
                  </div>
                  <p className="text-muted-foreground shrink-0 text-xs font-medium">
                    {formatInBusinessTimezone(appointment.startsAt, business.timezone, "HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard
          title="Conversaciones recientes"
          action={
            <Link
              href="/dashboard/conversations"
              className="text-brand-700 text-xs font-medium hover:underline"
            >
              Ver todas
            </Link>
          }
        >
          {conversations.length === 0 ? (
            <EmptyState
              title="Todavía no hay conversaciones"
              className="border-0 bg-transparent p-0 py-8"
            />
          ) : (
            <ul className="divide-border flex flex-col divide-y">
              {conversations.slice(0, 5).map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/dashboard/conversations/${conversation.id}`}
                    className="hover:text-foreground flex items-center justify-between gap-4 py-3 text-sm transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate font-medium">
                        {conversation.clientName}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {conversation.lastMessagePreview ?? "Sin mensajes"}
                      </p>
                    </div>
                    <p className="text-muted-foreground shrink-0 text-xs">
                      {formatInBusinessTimezone(
                        conversation.lastMessageAt,
                        business.timezone,
                        "d MMM",
                        {
                          locale: es,
                        },
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
