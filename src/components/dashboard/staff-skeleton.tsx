import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function StaffSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <Card className="shadow-floating">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-full" />
        <div className="mt-5 flex flex-col gap-4">
          <FieldSkeleton />
          <FieldSkeleton />
          <Skeleton className="mt-1 h-10 w-full" />
        </div>
      </Card>
    </div>
  );
}
