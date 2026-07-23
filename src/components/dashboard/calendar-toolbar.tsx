"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface CalendarToolbarProps {
  view: "day" | "week";
  rangeLabel: string;
  todayDate: string;
  isPending: boolean;
  onNavigate: (params: { view?: "day" | "week"; date?: string }) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarToolbar({
  view,
  rangeLabel,
  todayDate,
  isPending,
  onNavigate,
  onPrev,
  onNext,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate({ date: todayDate })}>
          Hoy
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} aria-label="Siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 pl-2">
          <h2 className="text-foreground text-[15px] font-semibold">{rangeLabel}</h2>
          {isPending && (
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" aria-hidden />
          )}
        </div>
      </div>

      <div className="shadow-soft border-border bg-card flex items-center rounded-lg border p-0.5">
        {(["day", "week"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onNavigate({ view: option })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out",
              view === option
                ? "bg-brand-600 shadow-soft text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option === "day" ? "Día" : "Semana"}
          </button>
        ))}
      </div>
    </div>
  );
}
