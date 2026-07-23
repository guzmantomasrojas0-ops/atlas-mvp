import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReservationsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="ml-2 h-5 w-40" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Card className="p-4">
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex-1 space-y-2">
                <Skeleton className="mx-auto h-3 w-8" />
                <Skeleton className="h-64 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-3 w-full" />
          <div className="mt-5 flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <Skeleton className="mt-1 h-10 w-full" />
          </div>
        </Card>
      </div>
    </div>
  );
}
