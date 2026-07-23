import { Suspense } from "react";
import { CustomerTable } from "@/components/dashboard/customer-table";
import { CustomersSkeleton } from "@/components/dashboard/customers-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listCustomers } from "@/modules/customer";

// Depende de estado real de la base (clientes existentes) — no debe quedar
// congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function CustomersPage() {
  return (
    <AppShell title="Clientes">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<CustomersSkeleton />}>
          <CustomersContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function CustomersContent() {
  const business = await getCurrentBusiness();

  const customers = await listCustomers(business.id);
  return <CustomerTable customers={customers} />;
}
