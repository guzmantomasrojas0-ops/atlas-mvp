import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-muted/30 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="shadow-soft bg-card text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
