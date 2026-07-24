"use client";

import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { Clock3, Phone, User } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  cancelAppointmentAction,
  confirmPaymentAction,
  rescheduleAppointmentAction,
  revertPaymentAction,
} from "@/app/dashboard/appointments/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { getStaffColor } from "@/lib/staff-colors";
import { formatInBusinessTimezone } from "@/modules/scheduling/domain";
import type { AppointmentListItem } from "@/modules/scheduling";

interface AppointmentDetailsPanelProps {
  appointment: AppointmentListItem;
  timezone: string;
  onNewReservation: () => void;
  /** Se llama después de cancelar con éxito, para que quien orquesta la saque de la lista local. */
  onCancelled?: () => void;
  /**
   * Se llama después de confirmar o revertir un pago con éxito, con el
   * `paymentStatus` ya resuelto — quien orquesta lo aplica directo al estado
   * local, sin pedirle al servidor los datos que ya tiene en la mano.
   */
  onPaymentChanged?: (paymentStatus: "PENDING" | "PAID") => void;
  /** Se llama después de reprogramar con éxito, con la cita ya actualizada. */
  onRescheduled?: (appointment: AppointmentListItem) => void;
}

type PanelMode = "idle" | "confirmCancel" | "reschedule" | "confirmPayment";

export function AppointmentDetailsPanel({
  appointment,
  timezone,
  onNewReservation,
  onCancelled,
  onPaymentChanged,
  onRescheduled,
}: AppointmentDetailsPanelProps) {
  const [mode, setMode] = useState<PanelMode>("idle");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, startCancel] = useTransition();

  const [rescheduleDate, setRescheduleDate] = useState(() =>
    formatInBusinessTimezone(appointment.startsAt, timezone, "yyyy-MM-dd"),
  );
  const [rescheduleTime, setRescheduleTime] = useState(() =>
    formatInBusinessTimezone(appointment.startsAt, timezone, "HH:mm"),
  );
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [isRescheduling, startReschedule] = useTransition();

  // Si `appointment` llega actualizado (ej. después de reprogramar con
  // éxito y refrescar), los campos de fecha/hora deben reflejar el horario
  // confirmado nuevo, no quedar pegados al valor con el que se abrió el panel.
  useEffect(() => {
    setRescheduleDate(formatInBusinessTimezone(appointment.startsAt, timezone, "yyyy-MM-dd"));
    setRescheduleTime(formatInBusinessTimezone(appointment.startsAt, timezone, "HH:mm"));
  }, [appointment.startsAt, timezone]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentConfirmedBy, setPaymentConfirmedBy] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [confirmPaymentError, setConfirmPaymentError] = useState<string | null>(null);
  const [revertPaymentError, setRevertPaymentError] = useState<string | null>(null);
  const [isConfirmingPayment, startConfirmPayment] = useTransition();
  const [isRevertingPayment, startRevertPayment] = useTransition();

  const color = getStaffColor(appointment.staffId);
  const dateLabel = formatInBusinessTimezone(appointment.startsAt, timezone, "EEEE d 'de' MMMM", {
    locale: es,
  });
  const timeLabel = `${formatInBusinessTimezone(appointment.startsAt, timezone, "HH:mm")} – ${formatInBusinessTimezone(
    appointment.endsAt,
    timezone,
    "HH:mm",
  )}`;

  function resetMode() {
    setMode("idle");
    setCancelError(null);
    setRescheduleError(null);
    setRescheduleDate(formatInBusinessTimezone(appointment.startsAt, timezone, "yyyy-MM-dd"));
    setRescheduleTime(formatInBusinessTimezone(appointment.startsAt, timezone, "HH:mm"));
    setConfirmPaymentError(null);
  }

  function handleConfirmCancel() {
    setCancelError(null);
    startCancel(async () => {
      const result = await cancelAppointmentAction(appointment.id);
      if (!result.success) {
        setCancelError(result.error);
        return;
      }
      onCancelled?.();
    });
  }

  function handleReschedule() {
    setRescheduleError(null);
    startReschedule(async () => {
      const result = await rescheduleAppointmentAction(appointment.id, {
        date: rescheduleDate,
        time: rescheduleTime,
      });
      if (!result.success) {
        setRescheduleError(result.error);
        return;
      }
      resetMode();
      onRescheduled?.(result.appointment);
    });
  }

  function handleConfirmPayment() {
    setConfirmPaymentError(null);
    startConfirmPayment(async () => {
      const result = await confirmPaymentAction(appointment.id, {
        amount: Number(paymentAmount),
        currency: "USD",
        method: "ZELLE",
        confirmedBy: paymentConfirmedBy,
        notes: paymentNotes.trim() || undefined,
      });
      if (!result.success) {
        setConfirmPaymentError(result.error);
        return;
      }
      setPaymentAmount("");
      setPaymentConfirmedBy("");
      setPaymentNotes("");
      resetMode();
      onPaymentChanged?.(result.paymentStatus);
    });
  }

  function handleRevertPayment() {
    setRevertPaymentError(null);
    startRevertPayment(async () => {
      const result = await revertPaymentAction(appointment.id);
      if (!result.success) {
        setRevertPaymentError(result.error);
        return;
      }
      onPaymentChanged?.(result.paymentStatus);
    });
  }

  return (
    <motion.div
      key={appointment.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="lg:sticky lg:top-24"
    >
      <Card className="p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-foreground text-base font-semibold">Detalle de la reserva</h2>
          <Button variant="ghost" size="sm" onClick={onNewReservation}>
            Nueva reserva
          </Button>
        </div>

        <div className={cn("mt-4 rounded-xl border p-4", color.bg, color.border)}>
          <p className={cn("text-sm font-semibold capitalize", color.text)}>
            {appointment.serviceName}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">con {appointment.staffName}</p>
        </div>

        <dl className="divide-border border-border mt-4 flex flex-col divide-y border-t">
          <InfoRow icon={User} label="Cliente" value={appointment.clientName} />
          <InfoRow icon={Clock3} label="Fecha" value={dateLabel} capitalize />
          <InfoRow icon={Clock3} label="Horario" value={timeLabel} />
        </dl>

        <div
          className={cn(
            "mt-4 flex items-center justify-between gap-2 rounded-xl border p-4",
            appointment.paymentStatus === "PAID"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-border bg-muted/60",
          )}
        >
          <div>
            <p
              className={cn(
                "text-sm font-semibold",
                appointment.paymentStatus === "PAID" ? "text-emerald-400" : "text-muted-foreground",
              )}
            >
              {appointment.paymentStatus === "PAID" ? "Pago confirmado" : "Pago pendiente"}
            </p>
            {revertPaymentError && (
              <p className="mt-1 text-xs text-red-400">{revertPaymentError}</p>
            )}
          </div>
          {mode === "idle" &&
            (appointment.paymentStatus === "PAID" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevertPayment}
                loading={isRevertingPayment}
              >
                Marcar como pendiente
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setMode("confirmPayment")}>
                Confirmar pago
              </Button>
            ))}
        </div>

        <div className="border-border mt-5 border-t pt-4">
          {mode === "confirmPayment" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-muted-foreground text-xs font-medium">Confirmar pago por Zelle</p>
              <FormField label="Monto (USD)" htmlFor="payment-amount">
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="25000"
                />
              </FormField>
              <FormField label="Confirmado por" htmlFor="payment-confirmed-by">
                <Input
                  id="payment-confirmed-by"
                  value={paymentConfirmedBy}
                  onChange={(event) => setPaymentConfirmedBy(event.target.value)}
                  placeholder="Tu nombre"
                />
              </FormField>
              <FormField label="Notas (opcional)" htmlFor="payment-notes">
                <Input
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Ej. transferencia terminada en 1234"
                />
              </FormField>
              {confirmPaymentError && <p className="text-sm text-red-400">{confirmPaymentError}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetMode}
                  disabled={isConfirmingPayment}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmPayment}
                  loading={isConfirmingPayment}
                >
                  Confirmar pago
                </Button>
              </div>
            </div>
          ) : mode === "confirmCancel" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-muted-foreground text-sm">
                ¿Confirmas que quieres cancelar esta reserva?
              </p>
              {cancelError && <p className="text-sm text-red-400">{cancelError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetMode} disabled={isCancelling}>
                  No, volver
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmCancel}
                  loading={isCancelling}
                  className="bg-red-600 shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-600"
                >
                  Sí, cancelar
                </Button>
              </div>
            </div>
          ) : mode === "reschedule" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-muted-foreground text-xs font-medium">Nueva fecha y hora</p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                />
                <Input
                  type="time"
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                />
              </div>
              {rescheduleError && <p className="text-sm text-red-400">{rescheduleError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetMode} disabled={isRescheduling}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReschedule}
                  loading={isRescheduling}
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("reschedule")}>
                Reprogramar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("confirmCancel")}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Cancelar reserva
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm first:pt-4">
      <span className="text-muted-foreground flex items-center gap-2">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
        {label}
      </span>
      <span className={cn("text-foreground text-right font-medium", capitalize && "capitalize")}>
        {value}
      </span>
    </div>
  );
}
