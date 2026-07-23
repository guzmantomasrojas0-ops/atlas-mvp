"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}

export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchable,
  searchPlaceholder,
  invalid,
  disabled,
}: SelectProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchable || query.trim() === "") return options;
    const q = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          "shadow-soft bg-card text-foreground flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors duration-150 ease-out outline-none",
          invalid
            ? "border-red-500/40 hover:border-red-500/60 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
            : "border-border hover:border-border-strong focus:border-brand-500 focus:ring-brand-500/20 focus:ring-2",
          "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
          "data-[placeholder]:text-muted-foreground",
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="shadow-floating border-border bg-card/95 z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border backdrop-blur-md"
        >
          {searchable && (
            <div className="border-border bg-card/95 sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 backdrop-blur-md">
              <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder ?? "Buscar…"}
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") event.stopPropagation();
                }}
              />
            </div>
          )}
          <SelectPrimitive.Viewport className="p-1">
            {filteredOptions.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">Sin resultados</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "relative flex cursor-pointer scroll-my-1 items-center rounded-md py-2 pr-8 pl-3 text-sm outline-none select-none",
                      "data-[highlighted]:bg-brand-500/15 data-[highlighted]:text-brand-200 transition-colors duration-150",
                      isSelected ? "text-brand-300 font-medium" : "text-foreground",
                    )}
                  >
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                      <Check className="text-brand-400 h-4 w-4" aria-hidden />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                );
              })
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
