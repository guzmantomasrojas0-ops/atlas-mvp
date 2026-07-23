import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";

/**
 * El gate real (DB-backed) para todo /dashboard: `middleware.ts` ya filtró
 * las visitas anónimas por cookie ausente (rápido, sin base), pero acá es
 * donde se valida de verdad que la sesión exista y no haya vencido — un solo
 * lugar, y cada página/Server Action bajo /dashboard puede confiar en que ya
 * corrió, sin repetir la lógica.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return children;
}
