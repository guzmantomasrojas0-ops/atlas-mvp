"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ConversationsShellProps {
  list: ReactNode;
  detail: ReactNode;
}

/**
 * En mobile solo se ve un panel a la vez (lista O detalle, como una app de
 * mensajes); en desktop (md+) los dos conviven siempre, sin importar la ruta.
 */
export function ConversationsShell({ list, detail }: ConversationsShellProps) {
  const pathname = usePathname();
  const isDetailView = pathname !== "/dashboard/conversations";

  return (
    <>
      <div
        className={cn(
          "border-border w-full shrink-0 flex-col border-r md:flex md:w-[340px]",
          isDetailView ? "hidden md:flex" : "flex",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col md:flex",
          isDetailView ? "flex" : "hidden md:flex",
        )}
      >
        {detail}
      </div>
    </>
  );
}
