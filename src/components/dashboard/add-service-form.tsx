"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createServiceAction } from "@/app/dashboard/services/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { serviceInputSchema, type ServiceInput } from "@/modules/catalog/domain";

export function AddServiceForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceInputSchema),
    defaultValues: {
      name: "",
      // "" en vez de 0/NaN: un input numérico vacío se ve vacío, no "0", y
      // Zod igual lo rechaza si nunca se completa.
      price: "" as unknown as number,
      durationMinutes: "" as unknown as number,
    },
  });

  async function onSubmit(values: ServiceInput) {
    setServerError(null);
    const result = await createServiceAction(values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    reset();
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-4 lg:sticky lg:top-24"
    >
      <Card className="p-6">
        <h2 className="text-foreground text-base font-semibold">Agregar servicio</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Sumá los servicios que ofrece tu negocio, con su precio y duración.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
          <FormField
            label="Nombre del servicio"
            htmlFor="service-name"
            error={errors.name?.message}
          >
            <Input
              id="service-name"
              type="text"
              placeholder="Ej. Corte de pelo"
              invalid={!!errors.name}
              {...register("name")}
            />
          </FormField>

          <FormField label="Precio" htmlFor="service-price" error={errors.price?.message}>
            <Input
              id="service-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="25000"
              invalid={!!errors.price}
              {...register("price", { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Duración (minutos)"
            htmlFor="service-duration"
            error={errors.durationMinutes?.message}
          >
            <Input
              id="service-duration"
              type="number"
              step="5"
              min="0"
              placeholder="45"
              invalid={!!errors.durationMinutes}
              {...register("durationMinutes", { valueAsNumber: true })}
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
            Agregar servicio
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
