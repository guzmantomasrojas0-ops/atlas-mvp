import { Suspense, type ReactNode } from "react";
import { ConversationsList } from "@/components/dashboard/conversations-list";
import { ConversationsListSkeleton } from "@/components/dashboard/conversations-skeleton";
import { ConversationsShell } from "@/components/dashboard/conversations-shell";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listConversations } from "@/modules/conversation";

// Depende de estado real de la base (conversaciones existentes) — no debe
// quedar congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function ConversationsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell title="Conversaciones">
      <div className="shadow-floating border-border/70 bg-card mx-auto flex h-[calc(100vh-9rem)] min-h-[560px] max-w-[1400px] overflow-hidden rounded-2xl border">
        <ConversationsShell
          list={
            <Suspense fallback={<ConversationsListSkeleton />}>
              <ConversationsListContent />
            </Suspense>
          }
          detail={children}
        />
      </div>
    </AppShell>
  );
}

async function ConversationsListContent() {
  const business = await getCurrentBusiness();

  const conversations = await listConversations(business.id);
  return <ConversationsList conversations={conversations} />;
}
