import { Suspense } from "react";
import { AddServiceForm } from "@/components/dashboard/add-service-form";
import { ServiceList } from "@/components/dashboard/service-list";
import { ServicesSkeleton } from "@/components/dashboard/services-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listServices } from "@/modules/catalog";

// Depende de estado real de la base (servicios existentes) — no debe quedar
// congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function ServicesPage() {
  return (
    <AppShell title="Servicios">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<ServicesSkeleton />}>
          <ServicesContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function ServicesContent() {
  const business = await getCurrentBusiness();

  const services = await listServices(business.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <ServiceList services={services} />
      <AddServiceForm />
    </div>
  );
}
