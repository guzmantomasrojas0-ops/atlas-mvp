import { CalendarPlus, MessageCircle, Package, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface OnboardingStep {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
}

const STEPS: OnboardingStep[] = [
  { label: "Crea tu primer servicio", icon: Package, href: "/dashboard/services" },
  { label: "Agrega tu primer empleado", icon: UserPlus, href: "/dashboard/staff" },
  { label: "Crea tu primera reserva", icon: CalendarPlus, href: "/dashboard/appointments" },
  { label: "Conecta WhatsApp", icon: MessageCircle },
];

/**
 * Se muestra solo cuando el negocio todavía no tiene servicios, equipo ni
 * clientes cargados — una vez que algo de eso exista, el resumen normal del
 * Dashboard (métricas + actividad reciente) ya cuenta la historia real. "Conecta
 * WhatsApp" no tiene href porque esa conexión hoy se hace por variables de
 * entorno + la consola de Meta, no desde la UI — mismo tratamiento que
 * "Configuración" en el Sidebar (badge "Pronto", sin link roto).
 */
export function GettingStartedCard() {
  return (
    <Card className="shadow-floating p-6">
      <h2 className="text-foreground text-base font-semibold">Empieza a usar ATLAS</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Todavía no tienes servicios, equipo ni clientes cargados. Completa estos pasos para dejar tu
        negocio listo para recibir reservas.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <OnboardingStepTile key={step.label} step={step} />
        ))}
      </div>
    </Card>
  );
}

function OnboardingStepTile({ step }: { step: OnboardingStep }) {
  const Icon = step.icon;

  if (!step.href) {
    return (
      <div
        aria-disabled="true"
        className="border-border flex cursor-not-allowed flex-col gap-2 rounded-xl border border-dashed p-4"
      >
        <div className="flex items-center justify-between">
          <Icon className="text-muted-foreground h-5 w-5" aria-hidden />
          <Badge>Pronto</Badge>
        </div>
        <span className="text-muted-foreground text-sm font-medium">{step.label}</span>
      </div>
    );
  }

  return (
    <Link
      href={step.href}
      className="border-border bg-card hover:border-border-strong ring-offset-background focus-visible:ring-brand-600 flex flex-col gap-2 rounded-xl border p-4 shadow-sm transition-colors duration-150 outline-none hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Icon className="text-brand-400 h-5 w-5" aria-hidden />
      <span className="text-foreground text-sm font-medium">{step.label}</span>
    </Link>
  );
}
