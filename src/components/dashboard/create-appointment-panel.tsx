"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { createAppointmentAction } from "@/app/dashboard/appointments/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import type { ServiceListItem, StaffMemberListItem } from "@/modules/catalog";
import {
  appointmentInputSchema,
  BUSINESS_HOURS_END,
  BUSINESS_HOURS_START,
  SLOT_MINUTES,
  type AppointmentInput,
} from "@/modules/scheduling/domain";
import type { AppointmentListItem } from "@/modules/scheduling";

const TIME_OPTIONS: SelectOption[] = Array.from(
  { length: ((BUSINESS_HOURS_END - BUSINESS_HOURS_START) * 60) / SLOT_MINUTES },
  (_, index) => {
    const minutes = BUSINESS_HOURS_START * 60 + index * SLOT_MINUTES;
    const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    return { value: label, label };
  },
);

export interface AppointmentDraft {
  staffId: string;
  serviceId: string;
  date: string;
  time: string;
}

interface CreateAppointmentPanelProps {
  services: ServiceListItem[];
  staffMembers: StaffMemberListItem[];
  prefill: { date?: string; time?: string; staffId?: string } | null;
  todayDate: string;
  conflict: AppointmentListItem | null;
  onDraftChange: (draft: AppointmentDraft) => void;
}

export function CreateAppointmentPanel({
  services,
  staffMembers,
  prefill,
  todayDate,
  conflict,
  onDraftChange,
}: CreateAppointmentPanelProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const serviceOptions: SelectOption[] = services.map((service) => ({
    value: service.id,
    label: `${service.name} · ${service.durationMinutes} min`,
  }));
  const staffOptions: SelectOption[] = staffMembers.map((staffMember) => ({
    value: staffMember.id,
    label: staffMember.name,
  }));

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentInput>({
    resolver: zodResolver(appointmentInputSchema),
    defaultValues: {
      staffId: prefill?.staffId ?? "",
      serviceId: "",
      clientName: "",
      clientPhone: "",
      date: prefill?.date ?? todayDate,
      time: prefill?.time ?? "",
    },
  });

  const staffId = watch("staffId");
  const serviceId = watch("serviceId");
  const date = watch("date");
  const time = watch("time");

  useEffect(() => {
    onDraftChange({ staffId, serviceId, date, time });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, serviceId, date, time]);

  const noServices = services.length === 0;
  const noStaff = staffMembers.length === 0;

  async function onSubmit(values: AppointmentInput) {
    setServerError(null);
    const result = await createAppointmentAction(values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    reset({
      staffId: "",
      serviceId: "",
      clientName: "",
      clientPhone: "",
      date: todayDate,
      time: "",
    });
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: 0.05, ease: "easeOut" }}
      className="lg:sticky lg:top-24"
    >
      <Card className="p-6">
        <h2 className="text-foreground text-base font-semibold">Nueva reserva</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Elegí el servicio, quién la atiende, y cuándo — la duración se calcula sola.
        </p>

        {noServices || noStaff ? (
          <p className="border-border bg-muted/60 text-muted-foreground mt-4 rounded-lg border border-dashed px-3 py-3 text-xs">
            Necesitás al menos un {noServices ? "servicio" : "miembro del equipo"} para poder
            agendar. Sumalo desde {noServices ? "Servicios" : "Equipo"} primero.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
            <FormField label="Servicio" htmlFor="appt-service" error={errors.serviceId?.message}>
              <Controller
                control={control}
                name="serviceId"
                render={({ field }) => (
                  <Select
                    id="appt-service"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={serviceOptions}
                    placeholder="Seleccioná un servicio"
                    invalid={!!errors.serviceId}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Miembro del equipo"
              htmlFor="appt-staff"
              error={errors.staffId?.message}
            >
              <Controller
                control={control}
                name="staffId"
                render={({ field }) => (
                  <Select
                    id="appt-staff"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={staffOptions}
                    placeholder="Seleccioná un miembro"
                    invalid={!!errors.staffId}
                  />
                )}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Fecha" htmlFor="appt-date" error={errors.date?.message}>
                <Input
                  id="appt-date"
                  type="date"
                  min={todayDate}
                  invalid={!!errors.date}
                  {...register("date")}
                />
              </FormField>

              <FormField label="Hora" htmlFor="appt-time" error={errors.time?.message}>
                <Controller
                  control={control}
                  name="time"
                  render={({ field }) => (
                    <Select
                      id="appt-time"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={TIME_OPTIONS}
                      placeholder="Hora"
                      invalid={!!errors.time}
                    />
                  )}
                />
              </FormField>
            </div>

            <FormField
              label="Nombre del cliente"
              htmlFor="appt-client-name"
              error={errors.clientName?.message}
            >
              <Input
                id="appt-client-name"
                type="text"
                placeholder="Ej. María Gómez"
                invalid={!!errors.clientName}
                {...register("clientName")}
              />
            </FormField>

            <FormField
              label="Teléfono (opcional)"
              htmlFor="appt-client-phone"
              error={errors.clientPhone?.message}
            >
              <Input
                id="appt-client-phone"
                type="tel"
                placeholder="+57 300 123 4567"
                invalid={!!errors.clientPhone}
                {...register("clientPhone")}
              />
            </FormField>

            {conflict && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Este horario se superpone con la reserva de {conflict.clientName} (
                {conflict.serviceName}).
              </p>
            )}

            {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Crear reserva
            </Button>
          </form>
        )}
      </Card>
    </motion.div>
  );
}
