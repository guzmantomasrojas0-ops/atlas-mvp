import { Suspense } from "react";
import { StaffExperience } from "@/components/dashboard/staff-experience";
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

  return <StaffExperience staffMembers={staffMembers} />;
}
