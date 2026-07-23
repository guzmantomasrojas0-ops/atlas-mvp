"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
// Del `domain/schema` directo, no del barrel `@/modules/auth`: ese barrel
// también reexporta `service.ts` (Prisma, node:crypto) — importar cualquier
// cosa de ahí desde un Client Component arrastra todo ese grafo al bundle
// del navegador y rompe el build. `domain/schema` es puro Zod, seguro acá.
import { loginInputSchema, type LoginInput } from "@/modules/auth/domain/schema";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await loginAction(values);
    // Si `loginAction` tiene éxito, redirige internamente y esta línea nunca
    // se ejecuta — solo llegamos acá cuando `result` trae un error.
    if (!result.success) {
      setServerError(result.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--color-zinc-900),_var(--color-zinc-950)_60%)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="shadow-floating">
          <CardHeader className="gap-2 pb-6">
            <div className="from-brand-500/20 to-brand-500/10 text-brand-300 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br">
              <LogIn className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-[15px]">
              Entrá con tu correo y contraseña para acceder a tu Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
              <FormField label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vos@tunegocio.com"
                  invalid={!!errors.email}
                  className="h-11"
                  {...register("email")}
                />
              </FormField>

              <FormField label="Contraseña" htmlFor="password" error={errors.password?.message}>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  invalid={!!errors.password}
                  className="h-11"
                  {...register("password")}
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

              <Button type="submit" size="lg" loading={isSubmitting} className="mt-1 w-full">
                Iniciar sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
