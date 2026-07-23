import { Skeleton } from "@/components/ui/skeleton";

export function ConversationsListSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border-border flex items-start gap-3 border-b px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationDetailSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border flex items-center gap-3 border-b px-6 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1 space-y-3 px-6 py-6">
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-16 w-3/5 rounded-2xl" />
        </div>
        <div className="border-border border-t p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="border-border hidden w-[300px] shrink-0 border-l p-4 xl:block">
        <div className="flex flex-col items-center gap-2 py-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="mt-4 h-24 w-full rounded-xl" />
        <Skeleton className="mt-3 h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
