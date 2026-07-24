"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { updateCustomerAction } from "@/app/dashboard/customers/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { customerInputSchema, type CustomerInput } from "@/modules/customer/domain";

interface EditCustomerFormProps {
  customerId: string;
  name: string;
  phone: string | null;
}

export function EditCustomerForm({ customerId, name, phone }: EditCustomerFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: { name, phone: phone ?? "" },
  });

  async function onSubmit(values: CustomerInput) {
    setServerError(null);
    setSaved(false);
    const result = await updateCustomerAction(customerId, values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <FormField label="Nombre" htmlFor="customer-name" error={errors.name?.message}>
        <Input id="customer-name" type="text" invalid={!!errors.name} {...register("name")} />
      </FormField>

      <div className="sm:min-w-[200px]">
        <FormField label="Teléfono" htmlFor="customer-phone" error={errors.phone?.message}>
          <Input
            id="customer-phone"
            type="tel"
            placeholder="+57 300 123 4567"
            invalid={!!errors.phone}
            {...register("phone")}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-1">
        <Button type="submit" loading={isSubmitting}>
          Guardar cambios
        </Button>
        {saved && <p className="text-xs text-emerald-400">Guardado.</p>}
        {serverError && (
          <p role="alert" className="text-xs text-red-400">
            {serverError}
          </p>
        )}
      </div>
    </form>
  );
}
