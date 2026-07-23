import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { StaffMemberListItem } from "@/modules/catalog";

export function StaffList({ staffMembers }: { staffMembers: StaffMemberListItem[] }) {
  if (staffMembers.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Todavía no tenés equipo"
        description="Agregá el primer miembro desde el formulario para que ATLAS sepa quién atiende a tus clientes."
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
            <li
              key={staffMember.id}
              className="flex items-center justify-between gap-4 py-4 first:pt-4"
            >
              <div className="flex items-center gap-3">
                <div className="bg-brand-500/10 text-brand-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Users className="h-4 w-4" />
                </div>
                <p className="text-foreground text-sm font-medium">{staffMember.name}</p>
              </div>
              <p className="text-muted-foreground text-sm">{staffMember.role}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
