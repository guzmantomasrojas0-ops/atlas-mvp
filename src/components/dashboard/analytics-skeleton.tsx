import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder de carga del panel de Analytics — misma grilla que el contenido real. */
export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-40 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
