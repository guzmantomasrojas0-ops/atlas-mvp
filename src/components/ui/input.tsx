import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "shadow-soft bg-card text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 text-sm transition-colors duration-150 ease-out outline-none",
        invalid
          ? "border-red-500/40 hover:border-red-500/60 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20"
          : "border-border hover:border-border-strong focus:border-brand-500 focus:ring-brand-500/20 focus:ring-2",
        "disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});
