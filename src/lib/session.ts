import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";
import { getSessionUser, type AuthenticatedUser, type Role } from "@/modules/auth";

export { SESSION_COOKIE_NAME };
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 días — igual a SESSION_DURATION_MS en el módulo auth

export interface BusinessRef {
  id: string;
  name: string;
  timezone: string;
}

export interface CurrentSession {
  user: AuthenticatedUser;
  business: BusinessRef;
}

export class ForbiddenError extends Error {
  constructor() {
    super("No tenés permiso para hacer esto.");
    this.name = "ForbiddenError";
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Resuelve la sesión actual sin redirigir si no hay una — a diferencia de
 * `requireSession()`, sirve para el caso inverso (ej. /login: si YA hay una
 * sesión válida, redirigir a /dashboard). `cache()` de React hace que
 * llamar esto varias veces en el mismo request (el gate del layout, la
 * page, un Server Action) solo pegue una vez contra la base.
 */
export const getOptionalSession = cache(async (): Promise<CurrentSession | null> => {
  const token = await getSessionCookieValue();
  if (!token) return null;

  const resolved = await getSessionUser(token);
  if (!resolved) return null;

  return {
    user: resolved.user,
    business: {
      id: resolved.user.businessId,
      name: resolved.businessName,
      timezone: resolved.businessTimezone,
    },
  };
});

/**
 * El único punto de autorización real del sistema: toda página, Server
 * Action o Route Handler que necesite saber "quién es" y "de qué negocio"
 * pasa por acá. Sin sesión válida, redirige a /login — no hay ningún otro
 * lugar del código que decida esto por su cuenta.
 */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return (await requireSession()).user;
}

export async function getCurrentBusiness(): Promise<BusinessRef> {
  return (await requireSession()).business;
}

/** Igual que `requireSession()`, pero además exige que el rol esté entre los permitidos — tira `ForbiddenError` si no, en vez de redirigir (para que cada Server Action decida cómo mostrar el mensaje). */
export async function requireRole(allowedRoles: Role[]): Promise<CurrentSession> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.user.role)) throw new ForbiddenError();
  return session;
}
