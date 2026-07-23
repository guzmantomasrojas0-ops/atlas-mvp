import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function BusinessSetupSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card className="shadow-floating">
        <CardHeader className="gap-2 pb-6">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FieldSkeleton />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          <Skeleton className="h-11 w-36" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="gap-2 pb-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <Skeleton className="h-1.5 w-full" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
