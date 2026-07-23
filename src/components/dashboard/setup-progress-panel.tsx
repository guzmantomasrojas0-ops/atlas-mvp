"use client";

import { motion } from "framer-motion";
import { Check, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

export interface ChecklistItem {
  label: string;
  done: boolean;
}

interface SetupProgressPanelProps {
  items: ChecklistItem[];
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0 },
};

export function SetupProgressPanel({ items }: SetupProgressPanelProps) {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-4 lg:sticky lg:top-24"
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progreso</CardTitle>
          <p className="text-muted-foreground text-xs">
            {done} de {total} completados
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <Progress value={pct} />
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2.5"
          >
            {items.map((item) => (
              <motion.li
                key={item.label}
                variants={itemVariants}
                className="flex items-center gap-2.5 text-sm"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                    item.done
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-border-strong text-transparent",
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span
                  className={cn(
                    "transition-colors duration-150",
                    item.done ? "text-muted-foreground line-through" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </CardContent>
      </Card>

      <Card className="border-brand-500/20 bg-brand-500/10 p-5">
        <div className="flex gap-3">
          <Lightbulb className="text-brand-400 mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-brand-200/80 text-xs leading-relaxed">
            Esta información la va a usar ATLAS para atender a tus clientes. Vas a poder
            actualizarla más adelante.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
