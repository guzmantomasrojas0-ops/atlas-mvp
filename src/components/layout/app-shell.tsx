import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getOptionalSession } from "@/lib/session";

interface AppShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export async function AppShell({ title, description, children }: AppShellProps) {
  const session = await getOptionalSession();

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--color-zinc-900),_var(--color-zinc-950)_60%)]">
      <Sidebar user={session?.user ?? null} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header title={title} description={description} />
        <main className="flex-1 px-6 py-8 sm:px-10 lg:px-12 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
