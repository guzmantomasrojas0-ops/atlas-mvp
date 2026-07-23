import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BusinessSetupExperience } from "@/components/dashboard/business-setup-experience";
import { BusinessSetupSkeleton } from "@/components/dashboard/business-setup-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getOptionalSession } from "@/lib/session";
import { getFirstBusiness } from "@/modules/business";

// Depende de estado real de la base que cambia en runtime (¿ya existe un
// negocio?) — no debe quedar congelado como HTML estático generado en build.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell title="Negocio">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<BusinessSetupSkeleton />}>
          <BusinessContent />
        </Suspense>
      </div>
    </AppShell>
  );
}

/**
 * Antes de que exista ningún negocio (instalación nueva) no hay sesión
 * posible todavía — por eso este chequeo usa `getFirstBusiness()` en vez de
 * `requireSession()`: es el único lugar del sistema donde "¿hay algo
 * configurado?" se pregunta sin asumir que alguien ya inició sesión. Una vez
 * que existe al menos un negocio, esta página deja de tener nada que
 * mostrar — solo redirige a donde corresponda.
 */
async function BusinessContent() {
  const business = await getFirstBusiness();
  if (!business) {
    return <BusinessSetupExperience />;
  }

  const session = await getOptionalSession();
  redirect(session ? "/dashboard" : "/login");
}
