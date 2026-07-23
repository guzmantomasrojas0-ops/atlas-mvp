import { Suspense } from "react";
import { ReservationsExperience } from "@/components/dashboard/reservations-experience";
import { ReservationsSkeleton } from "@/components/dashboard/reservations-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listServices, listStaffMembers } from "@/modules/catalog";
import { listAppointments } from "@/modules/scheduling";
import { getCalendarRange, todayInTimezone } from "@/modules/scheduling/domain";

// Depende de estado real de la base (reservas existentes, filtradas por rango
// visible) — no debe quedar congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

interface ReservationsPageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const params = await searchParams;

  return (
    <AppShell title="Reservas">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<ReservationsSkeleton />}>
          <ReservationsContent view={params.view} date={params.date} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function ReservationsContent({
  view: rawView,
  date: rawDate,
}: {
  view?: string;
  date?: string;
}) {
  const business = await getCurrentBusiness();

  const view = rawView === "day" ? "day" : "week";
  const todayDate = todayInTimezone(business.timezone);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDate;

  const { rangeStart, rangeEnd } = getCalendarRange(view, date, business.timezone);

  const [services, staffMembers, appointments] = await Promise.all([
    listServices(business.id),
    listStaffMembers(business.id),
    listAppointments(business.id, rangeStart, rangeEnd),
  ]);

  return (
    <ReservationsExperience
      view={view}
      date={date}
      timezone={business.timezone}
      todayDate={todayDate}
      appointments={appointments}
      services={services}
      staffMembers={staffMembers}
    />
  );
}
