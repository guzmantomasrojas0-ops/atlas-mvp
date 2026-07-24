import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomersSkeleton() {
  return (
    <Card className="shadow-floating overflow-hidden p-6">
      <Skeleton className="h-5 w-32" />
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CustomerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="shadow-floating p-6">
          <Skeleton className="h-4 w-36" />
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}
