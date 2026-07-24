import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CustomerDetailSkeleton } from "@/components/dashboard/customers-skeleton";
import { CustomerDetailView } from "@/components/dashboard/customer-detail-view";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { getCustomerDetail } from "@/modules/customer";

// Depende de estado real de la base (historial del cliente) — no debe quedar
// congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

interface CustomerDetailPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { customerId } = await params;
  return (
    <AppShell title="Cliente">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<CustomerDetailSkeleton />}>
          <CustomerDetailContent customerId={customerId} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function CustomerDetailContent({ customerId }: { customerId: string }) {
  const business = await getCurrentBusiness();

  const customer = await getCustomerDetail(business.id, customerId);
  if (!customer) {
    redirect("/dashboard/customers");
  }

  return <CustomerDetailView customer={customer} timezone={business.timezone} />;
}
