"use client";

import { useState } from "react";
import { AddStaffForm } from "@/components/dashboard/add-staff-form";
import { StaffDetailsPanel } from "@/components/dashboard/staff-details-panel";
import { StaffList } from "@/components/dashboard/staff-list";
import type { StaffMemberListItem } from "@/modules/catalog";

interface StaffExperienceProps {
  staffMembers: StaffMemberListItem[];
}

export function StaffExperience({ staffMembers: staffMembersProp }: StaffExperienceProps) {
  const [staffMembers, setStaffMembers] = useState(staffMembersProp);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = staffMembers.find((staffMember) => staffMember.id === selectedId) ?? null;

  function handleUpdated(updated: StaffMemberListItem) {
    setStaffMembers((current) =>
      current.map((staffMember) => (staffMember.id === updated.id ? updated : staffMember)),
    );
  }

  function handleDeleted(id: string) {
    setStaffMembers((current) => current.filter((staffMember) => staffMember.id !== id));
    setSelectedId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <StaffList
        staffMembers={staffMembers}
        selectedStaffId={selectedId}
        onSelect={(staffMember) => setSelectedId(staffMember.id)}
      />

      {selected ? (
        <StaffDetailsPanel
          key={selected.id}
          staffMember={selected}
          onNewMember={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ) : (
        <AddStaffForm
          onCreated={(staffMember) => setStaffMembers((current) => [...current, staffMember])}
        />
      )}
    </div>
  );
}
