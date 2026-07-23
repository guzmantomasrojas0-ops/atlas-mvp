"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getSessionCookieValue } from "@/lib/session";
import { logout } from "@/modules/auth";

export async function logoutAction(): Promise<void> {
  const token = await getSessionCookieValue();
  if (token) {
    await logout(token);
  }
  await clearSessionCookie();
  redirect("/login");
}
