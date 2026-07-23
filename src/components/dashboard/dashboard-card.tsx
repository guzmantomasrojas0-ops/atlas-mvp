import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface DashboardCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card genérica de sección del Dashboard: título + acción opcional (ej. "Ver todas") + contenido libre. */
export function DashboardCard({ title, action, children, className }: DashboardCardProps) {
  return (
    <Card className={cn("shadow-floating", className)}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
