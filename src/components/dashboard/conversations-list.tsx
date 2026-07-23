"use client";

import { MessagesSquare, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChannelIcon } from "@/components/dashboard/channel-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { ConversationListItem } from "@/modules/conversation";
// Importa de `domain` (puro), no del índice público del módulo, que también
// re-exporta `service.ts` (Prisma) y rompería el bundle del cliente.
import { formatRelativeTime, type ConversationChannelValue } from "@/modules/conversation/domain";

type FilterValue = "ALL" | "UNREAD" | ConversationChannelValue;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "UNREAD", label: "No leídas" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK_MESSENGER", label: "Messenger" },
  { value: "SMS", label: "SMS" },
  { value: "WEB_CHAT", label: "Chat web" },
];

interface ConversationsListProps {
  conversations: ConversationListItem[];
}

export function ConversationsList({ conversations }: ConversationsListProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === "UNREAD" && !conversation.unread) return false;
      if (filter !== "ALL" && filter !== "UNREAD" && conversation.channel !== filter) return false;
      if (!q) return true;
      return (
        conversation.clientName.toLowerCase().includes(q) ||
        (conversation.lastMessagePreview ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-4">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversaciones…"
            aria-label="Buscar conversaciones"
            className="focus:border-brand-500 focus:ring-brand-500/20 border-border bg-muted text-foreground placeholder:text-muted-foreground focus:bg-card w-full rounded-lg border py-2 pr-3 pl-9 text-sm transition-colors duration-150 outline-none focus:ring-2"
          />
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out",
                filter === item.value
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-zinc-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState
            className="m-4 border-0"
            icon={<MessagesSquare className="h-5 w-5" />}
            title="Todavía no tenés conversaciones"
            description="Cuando conectes un canal, van a aparecer acá."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="m-4 border-0"
            icon={<Search className="h-5 w-5" />}
            title="Sin resultados"
            description="Probá con otra búsqueda o filtro."
          />
        ) : (
          filtered.map((conversation) => {
            const isActive = pathname === `/dashboard/conversations/${conversation.id}`;
            return (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                className={cn(
                  "border-border flex items-start gap-3 border-b px-4 py-3 transition-colors duration-150 ease-out",
                  isActive ? "bg-brand-500/10" : "hover:bg-muted",
                )}
              >
                <Avatar id={conversation.clientId} name={conversation.clientName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        conversation.unread
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground font-medium",
                      )}
                    >
                      {conversation.clientName}
                    </p>
                    <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
                      {formatRelativeTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <ChannelIcon
                      channel={conversation.channel}
                      className="text-muted-foreground h-3 w-3 shrink-0"
                    />
                    <p
                      className={cn(
                        "truncate text-xs",
                        conversation.unread ? "text-muted-foreground" : "text-muted-foreground",
                      )}
                    >
                      {conversation.lastMessagePreview ?? "Sin mensajes todavía"}
                    </p>
                  </div>
                </div>
                {conversation.unread && (
                  <span
                    className="bg-brand-600 mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    aria-label="No leído"
                  />
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
