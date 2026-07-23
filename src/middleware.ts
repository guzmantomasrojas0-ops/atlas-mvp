import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * El primer gate para todo /dashboard y sus Server Actions (que Next.js
 * despacha como POST a la misma ruta de la página). Middleware corre en el
 * Edge Runtime, donde Prisma no funciona — por eso acá solo se verifica que
 * la cookie de sesión EXISTA (redirect rápido para visitantes anónimos, sin
 * tocar la base). La validación real (¿existe esa sesión?, ¿venció?, ¿qué
 * usuario/negocio es?) vive en `requireSession()` (lib/session.ts), que
 * corre en el runtime de Node donde sí hay Prisma — ese es el único punto
 * que decide autorización de verdad. Esto es una optimización de UX, no una
 * segunda implementación de la regla.
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
