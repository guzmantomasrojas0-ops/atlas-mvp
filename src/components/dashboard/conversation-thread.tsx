"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { sendMessageAction } from "@/app/dashboard/conversations/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { MessageItem } from "@/modules/conversation";
import { formatRelativeTime } from "@/modules/conversation/domain";

interface ConversationThreadProps {
  conversationId: string;
  initialMessages: MessageItem[];
}

const NEAR_BOTTOM_THRESHOLD_PX = 120;

export function ConversationThread({ conversationId, initialMessages }: ConversationThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const prevConversationId = useRef(conversationId);

  useEffect(() => {
    setMessages(initialMessages);
    if (prevConversationId.current !== conversationId) {
      shouldAutoScroll.current = true;
      prevConversationId.current = conversationId;
    }
  }, [initialMessages, conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
  }

  async function sendDraft() {
    const content = draft.trim();
    if (!content) return;

    setError(null);
    setDraft("");
    shouldAutoScroll.current = true;

    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, sender: "STAFF", content, createdAt: new Date() },
    ]);

    const result = await sendMessageAction(conversationId, content);
    if (!result.success) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setDraft(content);
      setError(result.error);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendDraft();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Todavía no hay mensajes en esta conversación.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const isOutbound = message.sender !== "CLIENT";
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "shadow-soft max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      isOutbound
                        ? "bg-brand-600 rounded-br-sm text-white"
                        : "border-border bg-card text-foreground rounded-bl-sm border",
                    )}
                  >
                    <p className="break-words whitespace-pre-wrap">{message.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        isOutbound ? "text-brand-100" : "text-muted-foreground",
                      )}
                    >
                      {message.sender === "AGENT" ? "ATLAS · " : ""}
                      {formatRelativeTime(message.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-border border-t p-4">
        {error && (
          <p role="alert" className="mb-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Escribí un mensaje…"
            aria-label="Escribir un mensaje"
            className="focus:border-brand-500 focus:ring-brand-500/20 border-border bg-card text-foreground placeholder:text-muted-foreground max-h-32 flex-1 resize-none rounded-lg border px-3 py-2.5 text-sm transition-colors duration-150 outline-none focus:ring-2"
          />
          <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Enviar mensaje">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
