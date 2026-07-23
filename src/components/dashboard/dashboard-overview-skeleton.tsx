import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="flex items-start justify-between gap-4 p-5">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-14" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="p-6">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
