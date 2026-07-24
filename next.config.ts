import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// NO se incluye Content-Security-Policy todavía — se probó (11 directivas
// distintas, con y sin `upgrade-insecure-requests`/`form-action`) y rompe de
// verdad: en `next dev` el login cae a un GET nativo con la contraseña en la
// URL en vez de la Server Action por POST, y contra un build de producción
// real (`next build && next start`, lo mismo que corre Playwright) fallan
// intermitentemente los flujos de agregar servicio, agregar miembro del
// equipo y confirmar un pago — todos comparten el patrón "la Server Action
// corre pero la actualización optimista de la UI nunca llega". No se pudo
// aislar la directiva exacta pese a probar sacando `upgrade-insecure-requests`
// y `form-action` por separado; sigue rompiendo con el resto de las
// directivas activas. Sospecha más probable: interacción entre el SDK de
// cliente de Sentry (que envuelve fetch/XHR globalmente para tracing) y
// `connect-src`, pero no se confirmó con Chrome DevTools real. Ver
// docs/operations/SECURITY.md — queda documentado como pendiente en vez de
// enviar una política a medio probar que le rompe el login o el alta de
// servicios a un cliente real.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Sin SENTRY_AUTH_TOKEN (credencial de organización, no la de un proyecto
// individual) no se puede subir source maps a Sentry — `disable: true`
// evita que el build intente autenticarse y falle en CI/local sin esa
// variable. Configurar org/project/token es un paso de FASE 5 (deploy),
// documentado en docs/operations/MONITORING.md.
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  sourcemaps: {
    disable: !hasSentryAuthToken,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
