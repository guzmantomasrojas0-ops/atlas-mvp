import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChannelBadge } from "@/components/dashboard/channel-badge";
import { ClientContextPanel } from "@/components/dashboard/client-context-panel";
import { ConversationDetailSkeleton } from "@/components/dashboard/conversations-skeleton";
import { ConversationThread } from "@/components/dashboard/conversation-thread";
import { MarkConversationRead } from "@/components/dashboard/mark-conversation-read";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentBusiness } from "@/lib/session";
import {
  ConversationNotFoundError,
  getConversation,
  listConversations,
  listMessages,
} from "@/modules/conversation";
import { getAppointmentsByClient } from "@/modules/scheduling";

// Depende de estado real de la base (mensajes, reservas del cliente) — no
// debe quedar congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;
  return (
    <Suspense fallback={<ConversationDetailSkeleton />}>
      <ConversationDetailContent conversationId={conversationId} />
    </Suspense>
  );
}

async function ConversationDetailContent({ conversationId }: { conversationId: string }) {
  const business = await getCurrentBusiness();

  let conversation;
  try {
    conversation = await getConversation(business.id, conversationId);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      redirect("/dashboard/conversations");
    }
    throw error;
  }

  const [messages, appointments, allConversations] = await Promise.all([
    listMessages(conversationId),
    getAppointmentsByClient(business.id, conversation.clientId),
    listConversations(business.id),
  ]);

  const conversationCount = allConversations.filter(
    (item) => item.clientId === conversation.clientId,
  ).length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <MarkConversationRead conversationId={conversationId} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-border flex items-center gap-3 border-b px-6 py-4">
          <Avatar id={conversation.clientId} name={conversation.clientName} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {conversation.clientName}
            </p>
            <ChannelBadge channel={conversation.channel} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ConversationThread conversationId={conversationId} initialMessages={messages} />
        </div>
      </div>

      <div className="border-border hidden w-[300px] shrink-0 border-l xl:block">
        <ClientContextPanel
          conversation={conversation}
          timezone={business.timezone}
          appointments={appointments}
          conversationCount={conversationCount}
        />
      </div>
    </div>
  );
}
