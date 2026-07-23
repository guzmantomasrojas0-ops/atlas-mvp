"use client";

import {
  BarChart3,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  UsersRound,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, type ComponentType } from "react";
import { logoutAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { AuthenticatedUser } from "@/modules/auth";

interface NavItem {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
}

const roleLabels: Record<AuthenticatedUser["role"], string> = {
  OWNER: "Dueño",
  MANAGER: "Gerente",
  STAFF: "Staff",
};

const mainNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Negocio", icon: Building2, href: "/" },
  { label: "Servicios", icon: Package, href: "/dashboard/services" },
  { label: "Equipo", icon: Users, href: "/dashboard/staff" },
  { label: "Reservas", icon: CalendarDays, href: "/dashboard/appointments" },
  { label: "Pagos", icon: Wallet, href: "/dashboard/payments" },
  { label: "Clientes", icon: UsersRound, href: "/dashboard/customers" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
  { label: "Conversaciones", icon: MessageSquare, href: "/dashboard/conversations" },
];

interface SidebarProps {
  user: AuthenticatedUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isLoggingOut, startLogout] = useTransition();

  return (
    <aside className="border-border/70 bg-card/70 sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="from-brand-500 to-brand-700 shadow-soft shadow-brand-600/30 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold text-white">
          A
        </div>
        <span className="text-foreground text-[15px] font-semibold tracking-tight">ATLAS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-muted-foreground px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase">
          Principal
        </p>
        <nav className="flex flex-col gap-0.5">
          {mainNavItems.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              active={
                !!item.href &&
                (pathname === item.href ||
                  // "/dashboard" es prefijo de todas las demás rutas nuevas
                  // (/dashboard/services, /dashboard/staff, etc.) — sin este
                  // caso especial, el ítem "Dashboard" quedaría marcado como
                  // activo en cualquier página del dashboard, no solo en el
                  // resumen.
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))
              }
            />
          ))}
        </nav>
      </div>

      <div className="border-border border-t px-3 py-3">
        {user && (
          <div className="mb-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{user.name}</p>
              <p className="text-muted-foreground text-xs">{roleLabels[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={() => startLogout(() => logoutAction())}
              disabled={isLoggingOut}
              aria-label="Cerrar sesión"
              className="text-muted-foreground hover:bg-muted hover:text-foreground ring-offset-background focus-visible:ring-brand-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <NavRow item={{ label: "Configuración", icon: Settings }} active={false} />
      </div>
    </aside>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={cn(
          "ring-offset-background focus-visible:ring-brand-600 relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2",
          active
            ? "bg-brand-500/10 text-brand-300"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {active && (
          <span
            aria-hidden
            className="bg-brand-600 absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full"
          />
        )}
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  }

  return (
    <div
      aria-disabled="true"
      className="text-muted-foreground flex cursor-not-allowed items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4" />
        {item.label}
      </span>
      <Badge>Pronto</Badge>
    </div>
  );
}
