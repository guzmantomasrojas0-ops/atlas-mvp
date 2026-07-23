import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {/* config options here */};

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
