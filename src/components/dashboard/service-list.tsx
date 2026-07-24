import { Clock3, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ServiceListItem } from "@/modules/catalog";

const priceFormatter = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

export function ServiceList({ services }: { services: ServiceListItem[] }) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-5 w-5" />}
        title="Todavía no tienes servicios"
        description="Agrega el primero desde el formulario para que ATLAS pueda ofrecerlo a tus clientes."
      />
    );
  }

  return (
    <Card className="shadow-floating">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {services.length === 1 ? "1 servicio" : `${services.length} servicios`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-border border-border flex flex-col divide-y border-t">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex items-center justify-between gap-4 py-4 first:pt-4"
            >
              <div className="flex items-center gap-3">
                <div className="bg-brand-500/10 text-brand-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">{service.name}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock3 className="h-3 w-3" />
                    {service.durationMinutes} min
                  </p>
                </div>
              </div>
              <p className="text-foreground text-sm font-semibold">
                ${priceFormatter.format(service.price)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
