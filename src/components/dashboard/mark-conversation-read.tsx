"use client";

import { useEffect, useRef } from "react";
import { markConversationReadAction } from "@/app/dashboard/conversations/actions";

/**
 * Dispara "marcar como leída" al montar, nunca durante el render del Server
 * Component — si lo hiciéramos durante el render, el prefetch de Next.js
 * (que se dispara con solo pasar el mouse sobre un link) marcaría
 * conversaciones como leídas sin que el usuario las haya abierto de verdad.
 */
export function MarkConversationRead({ conversationId }: { conversationId: string }) {
  const lastMarked = useRef<string | null>(null);

  useEffect(() => {
    if (lastMarked.current === conversationId) return;
    lastMarked.current = conversationId;
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  return null;
}
