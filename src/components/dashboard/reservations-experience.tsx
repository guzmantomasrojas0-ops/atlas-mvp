"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AppointmentDetailsPanel } from "@/components/dashboard/appointment-details-panel";
import { CalendarGrid } from "@/components/dashboard/calendar-grid";
import { CalendarToolbar } from "@/components/dashboard/calendar-toolbar";
import {
  CreateAppointmentPanel,
  type AppointmentDraft,
} from "@/components/dashboard/create-appointment-panel";
import type { ServiceListItem, StaffMemberListItem } from "@/modules/catalog";
import {
  addDays,
  findConflict,
  formatCalendarRangeLabel,
  toUtcInstant,
} from "@/modules/scheduling/domain";
import type { AppointmentListItem } from "@/modules/scheduling";

interface ReservationsExperienceProps {
  view: "day" | "week";
  date: string;
  timezone: string;
  todayDate: string;
  appointments: AppointmentListItem[];
  services: ServiceListItem[];
  staffMembers: StaffMemberListItem[];
}

interface SlotPrefill {
  date?: string;
  time?: string;
  staffId?: string;
}

export function ReservationsExperience({
  view,
  date,
  timezone,
  todayDate,
  appointments: appointmentsProp,
  services,
  staffMembers,
}: ReservationsExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // `appointments` vive en estado local, sembrado desde la prop del Server
  // Component — confirmar/revertir un pago, reprogramar o cancelar ya
  // devuelven el dato actualizado desde la propia Server Action, así que se
  // parchea acá directo sin pedirle al servidor que vuelva a mandar todo
  // (`router.refresh()`) solo para traer de vuelta lo que ya se tiene.
  const [appointments, setAppointments] = useState(appointmentsProp);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentListItem | null>(null);
  const [prefill, setPrefill] = useState<SlotPrefill | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);

  // La prop SÍ cambia cuando el Server Component vuelve a buscar datos de
  // verdad (navegar a otra fecha/vista, crear una reserva) — ahí el estado
  // local se resincroniza con la fuente de verdad del servidor.
  useEffect(() => {
    setAppointments(appointmentsProp);
  }, [appointmentsProp]);

  // Al navegar a otra fecha/vista, una reserva seleccionada puede dejar de
  // ser relevante (o ni figurar ya entre los datos cargados) — volvemos al
  // panel de "nueva reserva" en vez de dejar el detalle viejo congelado.
  useEffect(() => {
    setSelectedAppointment(null);
    setPrefill(null);
  }, [view, date]);

  function navigate(params: { view?: "day" | "week"; date?: string }) {
    const searchParams = new URLSearchParams();
    searchParams.set("view", params.view ?? view);
    searchParams.set("date", params.date ?? date);
    startTransition(() => {
      router.push(`${pathname}?${searchParams.toString()}`, { scroll: false });
    });
  }

  function handleSelectSlot(slot: SlotPrefill) {
    setSelectedAppointment(null);
    setPrefill(slot);
  }

  function handleSelectAppointment(appointment: AppointmentListItem) {
    setSelectedAppointment(appointment);
    setPrefill(null);
  }

  function handleNewReservation() {
    setSelectedAppointment(null);
    setPrefill(null);
  }

  function handleCancelled() {
    const cancelledId = selectedAppointment?.id;
    setAppointments((current) => current.filter((appointment) => appointment.id !== cancelledId));
    setSelectedAppointment(null);
    setPrefill(null);
  }

  function handlePaymentChanged(paymentStatus: "PENDING" | "PAID") {
    setSelectedAppointment((current) => (current ? { ...current, paymentStatus } : current));
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === selectedAppointment?.id ? { ...appointment, paymentStatus } : appointment,
      ),
    );
  }

  function handleRescheduled(updated: AppointmentListItem) {
    setSelectedAppointment(updated);
    setAppointments((current) =>
      current.map((appointment) => (appointment.id === updated.id ? updated : appointment)),
    );
  }

  const conflict = useMemo(() => {
    if (!draft?.staffId || !draft.serviceId || !draft.date || !draft.time) return null;
    const service = services.find((item) => item.id === draft.serviceId);
    if (!service) return null;

    const startsAt = toUtcInstant(draft.date, draft.time, timezone);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const candidates = appointments.filter((appointment) => appointment.staffId === draft.staffId);
    return findConflict({ startsAt, endsAt }, candidates) ?? null;
  }, [draft, services, appointments, timezone]);

  const conflictAppointmentIds = useMemo(() => new Set(conflict ? [conflict.id] : []), [conflict]);

  const rangeLabel = useMemo(() => formatCalendarRangeLabel(view, date), [view, date]);

  return (
    <div className="flex flex-col gap-6">
      <CalendarToolbar
        view={view}
        rangeLabel={rangeLabel}
        todayDate={todayDate}
        isPending={isPending}
        onNavigate={navigate}
        onPrev={() => navigate({ date: addDays(date, view === "day" ? -1 : -7) })}
        onNext={() => navigate({ date: addDays(date, view === "day" ? 1 : 7) })}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <CalendarGrid
          view={view}
          date={date}
          timezone={timezone}
          appointments={appointments}
          staffMembers={staffMembers}
          selectedAppointmentId={selectedAppointment?.id ?? null}
          conflictAppointmentIds={conflictAppointmentIds}
          onSelectAppointment={handleSelectAppointment}
          onSelectSlot={handleSelectSlot}
        />

        {selectedAppointment ? (
          <AppointmentDetailsPanel
            appointment={selectedAppointment}
            timezone={timezone}
            onNewReservation={handleNewReservation}
            onCancelled={handleCancelled}
            onPaymentChanged={handlePaymentChanged}
            onRescheduled={handleRescheduled}
          />
        ) : (
          <CreateAppointmentPanel
            key={JSON.stringify(prefill)}
            services={services}
            staffMembers={staffMembers}
            prefill={prefill}
            todayDate={todayDate}
            conflict={conflict}
            onDraftChange={setDraft}
          />
        )}
      </div>
    </div>
  );
}
