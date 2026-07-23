import { Suspense } from "react";
import { AnalyticsExperience } from "@/components/dashboard/analytics-experience";
import { AnalyticsSkeleton } from "@/components/dashboard/analytics-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentBusiness } from "@/lib/session";
import { getAnalyticsOverview, parseAnalyticsPeriod } from "@/modules/analytics";

// Depende de estado real de la base (agregaciones en vivo) — nunca estático.
export const dynamic = "force-dynamic";

interface AnalyticsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const { period: rawPeriod } = await searchParams;

  return (
    <AppShell title="Analytics">
      <div className="mx-auto max-w-6xl">
        <Suspense key={rawPeriod} fallback={<AnalyticsSkeleton />}>
          <AnalyticsContent rawPeriod={rawPeriod} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function AnalyticsContent({ rawPeriod }: { rawPeriod?: string }) {
  const business = await getCurrentBusiness();
  const period = parseAnalyticsPeriod(rawPeriod);
  const overview = await getAnalyticsOverview(business.id, business.timezone, period);

  return <AnalyticsExperience overview={overview} period={period} timezone={business.timezone} />;
}
