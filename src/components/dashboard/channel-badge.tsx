import {
  Camera,
  Globe,
  MessageCircle,
  MessagesSquare,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
// Importa de `domain` (puro) y no del índice público del módulo, que también
// re-exporta `service.ts` (Prisma) y rompería el bundle del cliente.
import { channelLabels, type ConversationChannelValue } from "@/modules/conversation/domain";

const CHANNEL_ICONS: Record<ConversationChannelValue, LucideIcon> = {
  WHATSAPP: MessageCircle,
  INSTAGRAM: Camera,
  FACEBOOK_MESSENGER: MessagesSquare,
  SMS: MessageSquareText,
  WEB_CHAT: Globe,
};

const CHANNEL_STYLES: Record<ConversationChannelValue, string> = {
  WHATSAPP: "bg-emerald-500/10 text-emerald-400",
  INSTAGRAM: "bg-pink-500/10 text-pink-400",
  FACEBOOK_MESSENGER: "bg-indigo-500/10 text-indigo-400",
  SMS: "bg-blue-500/10 text-blue-400",
  WEB_CHAT: "bg-muted text-muted-foreground",
};

export function ChannelIcon({
  channel,
  className,
}: {
  channel: ConversationChannelValue;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[channel];
  return <Icon className={className} aria-hidden />;
}

export function ChannelBadge({ channel }: { channel: ConversationChannelValue }) {
  const Icon = CHANNEL_ICONS[channel];
  return (
    <Badge className={cn("gap-1", CHANNEL_STYLES[channel])}>
      <Icon className="h-3 w-3" aria-hidden />
      {channelLabels[channel]}
    </Badge>
  );
}
