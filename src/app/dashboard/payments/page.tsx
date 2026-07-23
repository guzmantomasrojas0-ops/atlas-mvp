import { Suspense } from "react";
import { PaymentsSkeleton } from "@/components/dashboard/payments-skeleton";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listPayments } from "@/modules/payments";

// Depende de estado real de la base (pagos existentes) — no debe quedar
// congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function PaymentsPage() {
  return (
    <AppShell title="Pagos" description="Pagos por Zelle confirmados manualmente por el negocio.">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<PaymentsSkeleton />}>
          <PaymentsContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function PaymentsContent() {
  const business = await getCurrentBusiness();

  const payments = await listPayments(business.id);
  return <PaymentsTable payments={payments} />;
}
