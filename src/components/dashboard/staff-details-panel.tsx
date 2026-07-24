"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import {
  deleteStaffMemberAction,
  setStaffMemberActiveAction,
  updateStaffMemberAction,
} from "@/app/dashboard/staff/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { staffMemberInputSchema, type StaffMemberInput } from "@/modules/catalog/domain";
import type { StaffMemberListItem } from "@/modules/catalog";

interface StaffDetailsPanelProps {
  staffMember: StaffMemberListItem;
  onNewMember: () => void;
  onUpdated: (staffMember: StaffMemberListItem) => void;
  onDeleted: (id: string) => void;
}

type PanelMode = "idle" | "confirmDelete";

export function StaffDetailsPanel({
  staffMember,
  onNewMember,
  onUpdated,
  onDeleted,
}: StaffDetailsPanelProps) {
  const [mode, setMode] = useState<PanelMode>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isTogglingActive, startToggleActive] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffMemberInput>({
    resolver: zodResolver(staffMemberInputSchema),
    defaultValues: { name: staffMember.name, role: staffMember.role },
  });

  async function onSubmit(values: StaffMemberInput) {
    setServerError(null);
    const result = await updateStaffMemberAction(staffMember.id, values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onUpdated(result.staffMember);
  }

  function handleToggleActive() {
    setActiveError(null);
    startToggleActive(async () => {
      const result = await setStaffMemberActiveAction(staffMember.id, !staffMember.active);
      if (!result.success) {
        setActiveError(result.error);
        return;
      }
      onUpdated(result.staffMember);
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteStaffMemberAction(staffMember.id);
      if (!result.success) {
        setDeleteError(result.error);
        setMode("idle");
        return;
      }
      onDeleted(staffMember.id);
    });
  }

  return (
    <motion.div
      key={staffMember.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-4 lg:sticky lg:top-24"
    >
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-base font-semibold">Editar miembro</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Actualiza el nombre o el rol de {staffMember.name}.
            </p>
          </div>
          {!staffMember.active && (
            <Badge className="bg-amber-500/10 text-amber-400">Inactivo</Badge>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
          <FormField label="Nombre" htmlFor="edit-staff-name" error={errors.name?.message}>
            <Input id="edit-staff-name" type="text" invalid={!!errors.name} {...register("name")} />
          </FormField>

          <FormField label="Rol" htmlFor="edit-staff-role" error={errors.role?.message}>
            <Input id="edit-staff-role" type="text" invalid={!!errors.role} {...register("role")} />
          </FormField>

          {serverError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {serverError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
            Guardar cambios
          </Button>
        </form>

        <div className="border-border mt-5 flex flex-col gap-2 border-t pt-5">
          {activeError && (
            <p role="alert" className="text-sm text-red-400">
              {activeError}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            loading={isTogglingActive}
            onClick={handleToggleActive}
            className="w-full"
          >
            {staffMember.active ? "Desactivar" : "Reactivar"}
          </Button>

          {mode === "confirmDelete" ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-sm">
                ¿Confirmas que quieres eliminar a {staffMember.name}? Esta acción no se puede
                deshacer.
              </p>
              {deleteError && (
                <p role="alert" className="text-sm text-red-400">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMode("idle")}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  loading={isDeleting}
                  className="flex-1 bg-red-600 shadow-red-600/20 hover:bg-red-700 focus-visible:ring-red-600"
                  onClick={handleDelete}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => setMode("confirmDelete")}
            >
              Eliminar miembro
            </Button>
          )}
        </div>

        <button
          type="button"
          onClick={onNewMember}
          className="text-muted-foreground hover:text-foreground mt-4 text-xs underline-offset-2 hover:underline"
        >
          Agregar otro miembro en cambio
        </button>
      </Card>
    </motion.div>
  );
}
