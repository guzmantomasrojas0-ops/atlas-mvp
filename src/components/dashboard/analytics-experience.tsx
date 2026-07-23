"use client";

import { motion } from "framer-motion";
import { CalendarCheck, DollarSign, MessageSquare, TrendingDown, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import {
  ANALYTICS_PERIODS,
  analyticsPeriodLabels,
  type AnalyticsOverview,
  type AnalyticsPeriod,
} from "@/modules/analytics/domain";

const currency = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.round(value * 100)}%`;
const money = (value: number) => `$${currency.format(value)}`;

interface AnalyticsExperienceProps {
  overview: AnalyticsOverview;
  period: AnalyticsPeriod;
  timezone: string;
}

export function AnalyticsExperience({ overview, period }: AnalyticsExperienceProps) {
  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector current={period} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ingresos"
          value={money(overview.revenueTotal)}
          icon={<DollarSign className="h-4 w-4" />}
          hint={analyticsPeriodLabels[period].toLowerCase()}
        />
        <MetricCard
          label="Reservas"
          value={overview.bookingsTotal}
          icon={<CalendarCheck className="h-4 w-4" />}
          hint={`${overview.bookingsConfirmed} confirmadas · ${overview.bookingsCancelled} canceladas`}
        />
        <MetricCard
          label="Clientes nuevos"
          value={overview.newClients}
          icon={<UserPlus className="h-4 w-4" />}
          hint={analyticsPeriodLabels[period].toLowerCase()}
        />
        <MetricCard
          label="Tasa de cancelación"
          value={percent(overview.cancellationRate)}
          icon={<TrendingDown className="h-4 w-4" />}
          hint={`${overview.bookingsCancelled} de ${overview.bookingsTotal}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard title="Ingresos por día" subtitle={money(overview.revenueTotal)}>
          <RevenueBars data={overview.revenueByDay} />
        </SectionCard>

        <div className="flex flex-col gap-6">
          <SectionCard title="Estado de cobros">
            <div className="flex flex-col gap-3">
              <StatRow
                label="Pagos confirmados"
                value={overview.paymentsConfirmed}
                tone="emerald"
              />
              <StatRow label="Pagos pendientes" value={overview.paymentsPending} tone="amber" />
            </div>
          </SectionCard>

          <SectionCard title="Conversión WhatsApp → Reserva">
            <div className="flex items-end justify-between gap-3">
              <p className="text-foreground text-3xl font-semibold tracking-tight">
                {percent(overview.whatsappConversionRate)}
              </p>
              <div className="text-muted-foreground flex items-center gap-1.5 pb-1 text-xs">
                <MessageSquare className="h-3.5 w-3.5" />
                {overview.whatsappConverted} de {overview.whatsappConversations}
              </div>
            </div>
            <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-brand-500 h-full rounded-full transition-all"
                style={{ width: percent(overview.whatsappConversionRate) }}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Servicios más vendidos">
          <TopServices data={overview.topServices} />
        </SectionCard>
        <SectionCard title="Horas pico">
          <PeakHours data={overview.peakHours} />
        </SectionCard>
      </div>
    </div>
  );
}

function PeriodSelector({ current }: { current: AnalyticsPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(period: AnalyticsPeriod) {
    const params = new URLSearchParams(searchParams);
    params.set("period", period);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div
      className={cn(
        "border-border bg-card inline-flex w-fit gap-0.5 rounded-lg border p-0.5",
        isPending && "opacity-70",
      )}
    >
      {ANALYTICS_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => select(period)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
            period === current
              ? "bg-brand-500/15 text-brand-300"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {analyticsPeriodLabels[period]}
        </button>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Card className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

function RevenueBars({ data }: { data: AnalyticsOverview["revenueByDay"] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin ingresos todavía"
        description="Los pagos confirmados aparecerán acá."
      />
    );
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((point) => (
        <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="bg-brand-500/70 group-hover:bg-brand-400 w-full rounded-t transition-colors"
              style={{ height: `${Math.max((point.amount / max) * 100, 2)}%` }}
              title={`${point.date}: ${money(point.amount)}`}
            />
          </div>
          <span className="text-muted-foreground text-[10px]">{point.date.slice(8, 10)}</span>
        </div>
      ))}
    </div>
  );
}

function TopServices({ data }: { data: AnalyticsOverview["topServices"] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin reservas todavía"
        description="Cuando haya reservas, verás el ranking."
      />
    );
  }
  const max = Math.max(...data.map((s) => s.bookings), 1);
  return (
    <div className="flex flex-col gap-3">
      {data.map((service) => (
        <div key={service.serviceId}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground truncate font-medium">{service.serviceName}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {service.bookings} · {money(service.revenue)}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-brand-500 h-full rounded-full"
              style={{ width: `${(service.bookings / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PeakHours({ data }: { data: AnalyticsOverview["peakHours"] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sin datos de horarios"
        description="Las horas más ocupadas aparecerán acá."
      />
    );
  }
  const max = Math.max(...data.map((h) => h.bookings), 1);
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((slot) => (
        <div key={slot.hour} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="bg-brand-500/70 w-full rounded-t"
              style={{ height: `${Math.max((slot.bookings / max) * 100, 4)}%` }}
              title={`${String(slot.hour).padStart(2, "0")}:00 — ${slot.bookings}`}
            />
          </div>
          <span className="text-muted-foreground text-[10px]">
            {String(slot.hour).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber";
}) {
  const toneStyles =
    tone === "emerald" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span
        className={cn(
          "inline-flex min-w-9 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold",
          toneStyles,
        )}
      >
        {value}
      </span>
    </div>
  );
}
