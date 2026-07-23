"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  /**
   * Ya renderizado (ej. `<Package className="h-4 w-4" />`), no el
   * componente en sí — un Server Component no puede pasarle una referencia
   * a un componente a un Client Component, solo elementos ya renderizados.
   */
  icon: ReactNode;
  hint?: string;
  className?: string;
}

/** Tile de una sola métrica (número + etiqueta) para el resumen del Dashboard. */
export function MetricCard({ label, value, icon, hint, className }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Card className={cn("flex items-start justify-between gap-4 p-5", className)}>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="text-muted-foreground mt-1 truncate text-xs">{hint}</p>}
        </div>
        <div className="bg-brand-500/10 text-brand-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
      </Card>
    </motion.div>
  );
}
