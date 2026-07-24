"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createStaffMemberAction } from "@/app/dashboard/staff/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { staffMemberInputSchema, type StaffMemberInput } from "@/modules/catalog/domain";
import type { StaffMemberListItem } from "@/modules/catalog";

interface AddStaffFormProps {
  onCreated: (staffMember: StaffMemberListItem) => void;
}

export function AddStaffForm({ onCreated }: AddStaffFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffMemberInput>({
    resolver: zodResolver(staffMemberInputSchema),
    defaultValues: { name: "", role: "" },
  });

  async function onSubmit(values: StaffMemberInput) {
    setServerError(null);
    const result = await createStaffMemberAction(values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    reset();
    onCreated(result.staffMember);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-4 lg:sticky lg:top-24"
    >
      <Card className="p-6">
        <h2 className="text-foreground text-base font-semibold">Agregar miembro del equipo</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Suma a las personas que atienden a tus clientes, con su rol.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
          <FormField label="Nombre" htmlFor="staff-name" error={errors.name?.message}>
            <Input
              id="staff-name"
              type="text"
              placeholder="Ej. Juan Pérez"
              invalid={!!errors.name}
              {...register("name")}
            />
          </FormField>

          <FormField label="Rol" htmlFor="staff-role" error={errors.role?.message}>
            <Input
              id="staff-role"
              type="text"
              placeholder="Ej. Barbero"
              invalid={!!errors.role}
              {...register("role")}
            />
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
            Agregar al equipo
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
