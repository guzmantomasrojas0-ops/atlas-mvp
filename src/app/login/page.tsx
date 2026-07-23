import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getOptionalSession } from "@/lib/session";

// Depende de si ya hay una sesión válida — no debe quedar congelado como
// HTML estático generado en build.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getOptionalSession();
  if (session) redirect("/dashboard");

  return <LoginForm />;
}
