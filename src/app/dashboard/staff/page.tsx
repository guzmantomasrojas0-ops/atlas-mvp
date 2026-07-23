import { Suspense } from "react";
import { AddStaffForm } from "@/components/dashboard/add-staff-form";
import { StaffList } from "@/components/dashboard/staff-list";
import { StaffSkeleton } from "@/components/dashboard/staff-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { listStaffMembers } from "@/modules/catalog";

// Depende de estado real de la base (equipo existente) — no debe quedar
// congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function StaffPage() {
  return (
    <AppShell title="Equipo">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<StaffSkeleton />}>
          <StaffContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function StaffContent() {
  const business = await getCurrentBusiness();

  const staffMembers = await listStaffMembers(business.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <StaffList staffMembers={staffMembers} />
      <AddStaffForm />
    </div>
  );
}
