import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function ConversationsPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={<MessagesSquare className="h-5 w-5" />}
        title="Seleccioná una conversación"
        description="Elegí una conversación de la lista para ver los mensajes."
      />
    </div>
  );
}
