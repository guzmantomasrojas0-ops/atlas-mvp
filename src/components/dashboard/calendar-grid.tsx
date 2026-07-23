"use client";

import { CalendarOff, Users } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { getStaffColor } from "@/lib/staff-colors";
// Solo helpers puros de `domain` acá — nunca el índice público del módulo,
// que también re-exporta `service.ts` (Prisma) y rompería el bundle del cliente.
import {
  addDays,
  BUSINESS_HOURS_END,
  BUSINESS_HOURS_START,
  computeEventLayout,
  getLocalDateAndMinutes,
  SLOT_MINUTES,
  startOfWeekIso,
} from "@/modules/scheduling/domain";
import type { AppointmentListItem } from "@/modules/scheduling";
import type { StaffMemberListItem } from "@/modules/catalog";

interface CalendarGridProps {
  view: "day" | "week";
  date: string;
  timezone: string;
  appointments: AppointmentListItem[];
  staffMembers: StaffMemberListItem[];
  selectedAppointmentId: string | null;
  conflictAppointmentIds: Set<string>;
  onSelectAppointment: (appointment: AppointmentListItem) => void;
  onSelectSlot: (slot: { date: string; time: string; staffId?: string }) => void;
}

const GRID_START_MINUTES = BUSINESS_HOURS_START * 60;
const GRID_END_MINUTES = BUSINESS_HOURS_END * 60;
const TOTAL_MINUTES = GRID_END_MINUTES - GRID_START_MINUTES;
const SLOT_COUNT = TOTAL_MINUTES / SLOT_MINUTES;
const ROW_HEIGHT_PX = 32;

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

interface Column {
  key: string;
  label: string;
  sublabel?: string;
  staffId?: string;
  date: string;
}

export function CalendarGrid({
  view,
  date,
  timezone,
  appointments,
  staffMembers,
  selectedAppointmentId,
  conflictAppointmentIds,
  onSelectAppointment,
  onSelectSlot,
}: CalendarGridProps) {
  const columns: Column[] = useMemo(() => {
    if (view === "week") {
      const weekStart = startOfWeekIso(date);
      return Array.from({ length: 7 }, (_, index) => {
        const columnDate = addDays(weekStart, index);
        const [, month, day] = columnDate.split("-");
        return {
          key: columnDate,
          label: WEEKDAY_LABELS[index],
          sublabel: `${day}/${month}`,
          date: columnDate,
        };
      });
    }
    return staffMembers.map((staffMember) => ({
      key: staffMember.id,
      label: staffMember.name,
      sublabel: staffMember.role,
      staffId: staffMember.id,
      date,
    }));
  }, [view, date, staffMembers]);

  const appointmentsByColumn = useMemo(() => {
    const map = new Map<string, AppointmentListItem[]>();
    for (const column of columns) map.set(column.key, []);

    for (const appointment of appointments) {
      const local = getLocalDateAndMinutes(appointment.startsAt, timezone);
      const columnKey = view === "week" ? local.date : appointment.staffId;
      const bucket = map.get(columnKey);
      if (bucket) bucket.push(appointment);
    }
    return map;
  }, [appointments, columns, timezone, view]);

  if (view === "day" && staffMembers.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Agregá tu equipo primero"
        description="La vista por día organiza las reservas por miembro del equipo — sumá al menos uno desde Equipo."
      />
    );
  }

  return (
    <div className="shadow-floating border-border/70 bg-card overflow-x-auto rounded-2xl border">
      <div className="flex min-w-[640px]">
        <div className="border-border w-16 shrink-0 border-r">
          <div className="border-border h-14 border-b" />
          {Array.from({ length: SLOT_COUNT }).map((_, index) => {
            const minutes = GRID_START_MINUTES + index * SLOT_MINUTES;
            return (
              <div
                key={index}
                style={{ height: ROW_HEIGHT_PX }}
                className="border-border relative border-b last:border-b-0"
              >
                {minutes % 60 === 0 && (
                  <span className="text-muted-foreground absolute -top-2 right-2 text-[11px]">
                    {minutesToTime(minutes)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}
        >
          {columns.map((column) => (
            <CalendarColumn
              key={column.key}
              column={column}
              appointments={appointmentsByColumn.get(column.key) ?? []}
              timezone={timezone}
              selectedAppointmentId={selectedAppointmentId}
              conflictAppointmentIds={conflictAppointmentIds}
              onSelectAppointment={onSelectAppointment}
              onSelectSlot={onSelectSlot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarColumn({
  column,
  appointments,
  timezone,
  selectedAppointmentId,
  conflictAppointmentIds,
  onSelectAppointment,
  onSelectSlot,
}: {
  column: Column;
  appointments: AppointmentListItem[];
  timezone: string;
  selectedAppointmentId: string | null;
  conflictAppointmentIds: Set<string>;
  onSelectAppointment: (appointment: AppointmentListItem) => void;
  onSelectSlot: (slot: { date: string; time: string; staffId?: string }) => void;
}) {
  const layout = useMemo(() => {
    const events = appointments.map((appointment) => {
      const local = getLocalDateAndMinutes(appointment.startsAt, timezone);
      const localEnd = getLocalDateAndMinutes(appointment.endsAt, timezone);
      return { id: appointment.id, startMinutes: local.minutes, endMinutes: localEnd.minutes };
    });
    return new Map(computeEventLayout(events).map((item) => [item.id, item]));
  }, [appointments, timezone]);

  return (
    <div className="border-border relative border-r last:border-r-0">
      <div className="border-border flex h-14 flex-col items-center justify-center border-b px-1 text-center">
        <p className="text-muted-foreground truncate text-xs font-semibold">{column.label}</p>
        {column.sublabel && (
          <p className="text-muted-foreground truncate text-[11px]">{column.sublabel}</p>
        )}
      </div>

      <div className="relative">
        {Array.from({ length: SLOT_COUNT }).map((_, index) => {
          const minutes = GRID_START_MINUTES + index * SLOT_MINUTES;
          const time = minutesToTime(minutes);
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              style={{ height: ROW_HEIGHT_PX }}
              onClick={() => onSelectSlot({ date: column.date, time, staffId: column.staffId })}
              className="hover:bg-brand-500/10 border-border block w-full border-b transition-colors duration-150 last:border-b-0"
              aria-label={`Elegir las ${time} para una nueva reserva`}
            />
          );
        })}

        {appointments.map((appointment) => {
          const local = getLocalDateAndMinutes(appointment.startsAt, timezone);
          const localEnd = getLocalDateAndMinutes(appointment.endsAt, timezone);
          const position = layout.get(appointment.id) ?? { lane: 0, laneCount: 1 };
          const color = getStaffColor(appointment.staffId);
          const isSelected = appointment.id === selectedAppointmentId;
          const isConflicting = conflictAppointmentIds.has(appointment.id);

          const top = ((local.minutes - GRID_START_MINUTES) / SLOT_MINUTES) * ROW_HEIGHT_PX;
          const height = ((localEnd.minutes - local.minutes) / SLOT_MINUTES) * ROW_HEIGHT_PX;
          const width = 100 / position.laneCount;
          const left = position.lane * width;

          return (
            <button
              key={appointment.id}
              type="button"
              onClick={() => onSelectAppointment(appointment)}
              style={{
                top,
                height: Math.max(height, ROW_HEIGHT_PX / 2),
                left: `${left}%`,
                width: `${width}%`,
              }}
              className={cn(
                "absolute overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-shadow duration-150",
                color.bg,
                color.text,
                color.border,
                isSelected && "ring-brand-500 ring-2",
                isConflicting && "ring-2 ring-red-500",
              )}
            >
              <p className="truncate font-semibold">{appointment.serviceName}</p>
              <p className="truncate opacity-80">{appointment.clientName}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarEmptyHint() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <CalendarOff className="h-3.5 w-3.5" />
      Sin reservas en este rango todavía.
    </div>
  );
}
