import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { StaffMemberListItem } from "@/modules/catalog";

interface StaffListProps {
  staffMembers: StaffMemberListItem[];
  selectedStaffId?: string | null;
  onSelect?: (staffMember: StaffMemberListItem) => void;
}

export function StaffList({ staffMembers, selectedStaffId, onSelect }: StaffListProps) {
  if (staffMembers.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Todavía no tienes equipo"
        description="Agrega el primer miembro desde el formulario para que ATLAS sepa quién atiende a tus clientes."
      />
    );
  }

  return (
    <Card className="shadow-floating">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {staffMembers.length === 1 ? "1 persona" : `${staffMembers.length} personas`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-border border-border flex flex-col divide-y border-t">
          {staffMembers.map((staffMember) => (
            <li key={staffMember.id}>
              <button
                type="button"
                onClick={() => onSelect?.(staffMember)}
                className={cn(
                  "ring-offset-background focus-visible:ring-brand-600 flex w-full items-center justify-between gap-4 rounded-lg py-4 text-left transition-colors duration-150 outline-none first:pt-4 focus-visible:ring-2 focus-visible:ring-offset-2",
                  onSelect && "hover:bg-muted cursor-pointer px-2",
                  selectedStaffId === staffMember.id && "bg-brand-500/10",
                  !staffMember.active && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-brand-500/10 text-brand-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{staffMember.name}</p>
                    <p className="text-muted-foreground text-xs">{staffMember.role}</p>
                  </div>
                </div>
                {!staffMember.active && (
                  <Badge className="bg-amber-500/10 text-amber-400">Inactivo</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
