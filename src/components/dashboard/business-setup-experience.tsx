"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { createBusinessAction, type SetupInput } from "@/app/actions";
import { SetupProgressPanel } from "@/components/dashboard/setup-progress-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
// Del `domain/schema` directo, no del barrel `@/modules/auth` — ver el
// comentario equivalente en components/auth/login-form.tsx.
import { createOwnerAccountInputSchema } from "@/modules/auth/domain/schema";
import {
  BUSINESS_TYPES,
  businessInputSchema,
  businessTypeLabels,
  type BusinessInput,
} from "@/modules/business/domain";

const setupFormSchema = z.object({
  business: businessInputSchema,
  owner: createOwnerAccountInputSchema,
});

const timezoneOptions: SelectOption[] = (
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
).map((tz) => ({ value: tz, label: tz }));

const businessTypeOptions: SelectOption[] = BUSINESS_TYPES.map((type) => ({
  value: type,
  label: businessTypeLabels[type],
}));

export function BusinessSetupExperience() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SetupInput>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: {
      business: {
        name: "",
        phone: "",
        address: "",
        // "" fuerza al usuario a elegir explícitamente — no es un valor válido
        // del enum/zona horaria, así que Zod lo rechaza si nunca se cambia.
        timezone: "" as BusinessInput["timezone"],
        businessType: "" as BusinessInput["businessType"],
      },
      owner: { name: "", email: "", password: "" },
    },
  });

  const watched = useWatch({ control });
  const checklist = [
    { label: "Nombre del negocio", done: Boolean(watched.business?.name?.trim()) },
    { label: "Teléfono", done: Boolean(watched.business?.phone?.trim()) },
    { label: "Dirección", done: Boolean(watched.business?.address?.trim()) },
    { label: "Zona horaria", done: Boolean(watched.business?.timezone) },
    { label: "Tipo de negocio", done: Boolean(watched.business?.businessType) },
    { label: "Tu nombre", done: Boolean(watched.owner?.name?.trim()) },
    { label: "Tu correo", done: Boolean(watched.owner?.email?.trim()) },
    {
      label: "Tu contraseña",
      done: Boolean(watched.owner?.password && watched.owner.password.length >= 8),
    },
  ];

  async function onSubmit(values: SetupInput) {
    setServerError(null);
    const result = await createBusinessAction(values);
    // Si tiene éxito, `createBusinessAction` redirige internamente a
    // /dashboard y esta línea nunca se ejecuta.
    if (!result.success) {
      setServerError(result.error);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Card className="shadow-floating">
          <CardHeader className="gap-2 pb-6">
            <CardTitle className="text-2xl">Configura tu negocio</CardTitle>
            <CardDescription className="text-[15px]">
              Estos datos los va a usar ATLAS para atender a tus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
              <FormField
                label="Nombre del negocio"
                htmlFor="business.name"
                error={errors.business?.name?.message}
              >
                <Input
                  id="business.name"
                  type="text"
                  placeholder="Ej. Barbería El Buen Corte"
                  invalid={!!errors.business?.name}
                  className="h-11"
                  {...register("business.name")}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  label="Teléfono"
                  htmlFor="business.phone"
                  error={errors.business?.phone?.message}
                >
                  <Input
                    id="business.phone"
                    type="tel"
                    placeholder="+57 300 123 4567"
                    invalid={!!errors.business?.phone}
                    className="h-11"
                    {...register("business.phone")}
                  />
                </FormField>

                <FormField
                  label="Dirección"
                  htmlFor="business.address"
                  error={errors.business?.address?.message}
                >
                  <Input
                    id="business.address"
                    type="text"
                    placeholder="Calle 45 #12-30, Bogotá"
                    invalid={!!errors.business?.address}
                    className="h-11"
                    {...register("business.address")}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  label="Zona horaria"
                  htmlFor="business.timezone"
                  error={errors.business?.timezone?.message}
                >
                  <Controller
                    control={control}
                    name="business.timezone"
                    render={({ field }) => (
                      <Select
                        id="business.timezone"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={timezoneOptions}
                        placeholder="Seleccioná una zona horaria"
                        searchable
                        searchPlaceholder="Buscar zona horaria…"
                        invalid={!!errors.business?.timezone}
                      />
                    )}
                  />
                </FormField>

                <FormField
                  label="Tipo de negocio"
                  htmlFor="business.businessType"
                  error={errors.business?.businessType?.message}
                >
                  <Controller
                    control={control}
                    name="business.businessType"
                    render={({ field }) => (
                      <Select
                        id="business.businessType"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={businessTypeOptions}
                        placeholder="Seleccioná un tipo"
                        invalid={!!errors.business?.businessType}
                      />
                    )}
                  />
                </FormField>
              </div>

              <div className="border-border border-t pt-6">
                <p className="text-foreground mb-1 text-sm font-semibold">Tu cuenta</p>
                <p className="text-muted-foreground mb-4 text-xs">
                  Vas a usar este correo y contraseña para iniciar sesión — sos el dueño (Owner) de
                  este negocio.
                </p>

                <div className="flex flex-col gap-5">
                  <FormField
                    label="Tu nombre"
                    htmlFor="owner.name"
                    error={errors.owner?.name?.message}
                  >
                    <Input
                      id="owner.name"
                      type="text"
                      placeholder="Tu nombre completo"
                      invalid={!!errors.owner?.name}
                      className="h-11"
                      {...register("owner.name")}
                    />
                  </FormField>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <FormField
                      label="Correo electrónico"
                      htmlFor="owner.email"
                      error={errors.owner?.email?.message}
                    >
                      <Input
                        id="owner.email"
                        type="email"
                        autoComplete="email"
                        placeholder="vos@tunegocio.com"
                        invalid={!!errors.owner?.email}
                        className="h-11"
                        {...register("owner.email")}
                      />
                    </FormField>

                    <FormField
                      label="Contraseña"
                      htmlFor="owner.password"
                      error={errors.owner?.password?.message}
                    >
                      <Input
                        id="owner.password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        invalid={!!errors.owner?.password}
                        className="h-11"
                        {...register("owner.password")}
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
                >
                  {serverError}
                </p>
              )}

              <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 self-start">
                Crear negocio
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <SetupProgressPanel items={checklist} />
    </div>
  );
}
