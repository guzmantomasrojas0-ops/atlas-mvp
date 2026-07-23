"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <motion.div
        className="bg-brand-600 h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      />
    </div>
  );
}
