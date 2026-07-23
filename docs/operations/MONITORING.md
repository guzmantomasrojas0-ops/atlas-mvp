# Monitoreo

Cómo ATLAS reporta errores y qué hace falta para que ese reporte llegue a
algún lado.

## Qué está cableado (funciona hoy, sin cuenta de Sentry)

- `@sentry/nextjs` está instalado y configurado en los tres runtimes que usa
  Next.js: cliente (`src/instrumentation-client.ts`), servidor
  (`src/sentry.server.config.ts`) y edge (`src/sentry.edge.config.ts`,
  usado por `src/middleware.ts`). El registro de los tres corre desde
  `src/instrumentation.ts`, el hook nativo de Next.js.
- `src/instrumentation.ts` también expone `onRequestError`, que Next.js llama
  automáticamente ante cualquier excepción no manejada en Server Components,
  Route Handlers o Server Actions.
- `src/app/global-error.tsx` captura errores de render que ni siquiera un
  `error.tsx` de segmento pudo atajar (incluye errores en el root layout).
- **`src/lib/logger.ts` reporta a Sentry automáticamente en cada
  `logger.error(...)`/`logger.fatal(...)`** — no hace falta llamar a Sentry a
  mano en cada lugar. Esto ya cubre, sin tocar un solo call site adicional:
  - Fallos de envío de WhatsApp (`messaging/adapters/whatsapp/whatsapp-adapter.ts`).
  - Errores del webhook de WhatsApp — firma inválida, configuración
    incompleta, excepciones al procesar un evento (`api/webhooks/whatsapp/route.ts`).
  - Fallos de notificaciones automáticas y `CRON_SECRET` mal configurado
    (`api/cron/notifications/route.ts`, `modules/notifications/service.ts`).
  - **Nuevo en este Sprint**: los 11 puntos donde una Server Action atrapaba
    un error inesperado (uno no tipado — un bug, una falla de Prisma, lo que
    sea) y lo descartaba en silencio, devolviendo solo un mensaje genérico al
    usuario ("No se pudo guardar... Intentá de nuevo.") sin dejar ningún
    rastro server-side. Eso ya no pasa: `createBusinessAction`,
    `loginAction`, `createStaffMemberAction`, `createServiceAction`,
    `sendMessageAction`, `markConversationReadAction`,
    `createAppointmentAction`, `cancelAppointmentAction`,
    `confirmPaymentAction`, `revertPaymentAction` y
    `rescheduleAppointmentAction` ahora loguean el error real antes de
    devolver el mensaje genérico.

## Qué falta para que esto reporte a un dashboard real

Sin `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, todo lo de arriba sigue
funcionando exactamente igual — `Sentry.captureException`/`captureMessage`
son no-ops (ver los `sentry.*.config.ts`, `enabled: Boolean(dsn)`). Esto es
intencional: nadie necesita una cuenta de Sentry para desarrollar, correr
tests, o pasar CI.

Para activarlo de verdad:

1. Crear una cuenta y un proyecto en [sentry.io](https://sentry.io) (o un
   Sentry self-hosted) — tipo de proyecto: Next.js.
2. Configurar en el hosting (Vercel u otro, ver `DEPLOYMENT.md`):
   - `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` (mismo valor).
   - Opcional pero recomendado: `SENTRY_ORG`, `SENTRY_PROJECT`,
     `SENTRY_AUTH_TOKEN` (token de organización, scope `project:releases`) —
     habilita que el build suba source maps, así los stack traces en Sentry
     muestran el código TypeScript real en vez de JS minificado.
3. Ajustar el sample rate de trazas para producción — `1.0` (100%) es el
   default acá porque es gratis mientras no haya tráfico real y sirve para
   verificar que la integración funciona; una vez con clientes reales, bajarlo
   con `SENTRY_TRACES_SAMPLE_RATE`/`NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
   (ej. `"0.1"`) para no gastar la cuota del plan en trazas de poco valor.
4. Redeploy. No hace falta tocar código.

**Esto no se pudo verificar en este Sprint** más allá de confirmar que el
build/typecheck/tests pasan con la integración instalada y que
`Sentry.init` recibe `enabled: false` sin DSN (comportamiento documentado
del SDK, no una suposición) — no hay cuenta de Sentry conectada a este
proyecto todavía, así que no hay captura de pantalla de un evento real
llegando al dashboard. Verificarlo end-to-end (generar un error a propósito
y confirmar que aparece en Sentry) es un paso pendiente antes del primer
cliente real, ver el Production Readiness Report.

## Observabilidad: logs estructurados, request id, métricas de IA

Todo lo de arriba es "algo falló". Esto es "qué pasó, cuánto tardó, cuánto
costó" — para responder eso sin tener que reproducir la conversación.

- **Logs estructurados**: ya existían (pino, `src/lib/logger.ts`) — cada
  línea es JSON, no texto libre, así que son filtrables/agregables por
  cualquier plataforma de logs (la del proveedor de hosting, o Sentry
  mismo).
- **Request id / correlation id**: `api/webhooks/whatsapp/route.ts` y
  `api/cron/notifications/route.ts` generan un `requestId`
  (`crypto.randomUUID()`) al entrar, lo incluyen en cada línea de log de
  ese request, y lo devuelven en el header `x-request-id` de la respuesta —
  así una línea de log puntual se puede correlacionar con el request que la
  generó sin adivinar por timestamp. Alcance real: estos dos Route Handlers
  (los únicos con lógica multi-paso que ya logueaba errores). No se extendió
  a todo `/dashboard/*` vía middleware — el matcher de `src/middleware.ts`
  hoy solo gatea autenticación, y mezclar ahí un request id de proceso
  ampliaría su alcance sin necesidad real: en Vercel, cada invocación ya
  tiene su propio id de request en los logs de la plataforma.
- **Duración de herramientas del Agente**: ya se medía (`executeTool` en
  `modules/agent/domain/execution.ts` calcula `executionTimeMs` desde el
  Sprint 9) pero nunca se registraba en ningún lado. Ahora
  `converseWithAgent` (`modules/agent/service.ts`) loguea, al final de cada
  turno, un resumen estructurado con la duración de cada tool llamada:
  ```json
  { "toolName": "SEARCH_AVAILABILITY", "success": true, "durationMs": 12 }
  ```
- **Consumo de tokens por turno de conversación**: `CompletionResponse.usage`
  (tokens de prompt/completion/total, ya lo devolvía cada `LanguageModel`)
  se descartaba en `runConversationLoop` — nunca se acumulaba ni se
  registraba. Ahora se suma en cada iteración del loop y se loguea junto con
  la duración total del turno:
  ```json
  {"businessId":"...","conversationId":"...","durationMs":13,"stopReason":"final_response","usage":{"promptTokens":842,"completionTokens":37,"totalTokens":879},"steps":[...],"msg":"converseWithAgent: turno completado."}
  ```
  Con `AI_PROVIDER=anthropic` esto ya son tokens reales de la API — sumando
  estas líneas por `conversationId` (vía cualquier agregador de logs) se
  obtiene el costo real de esa conversación, no una estimación.
- **Tiempos de respuesta HTTP** (todas las rutas, no solo el Agente): no se
  construyó un sistema de métricas propio para esto — decisión deliberada,
  no un vacío. `tracesSampleRate` de Sentry (ver arriba) ya instrumenta
  automáticamente duración de Route Handlers y Server Components una vez que
  hay DSN configurado; sumarle un sistema de métricas paralelo sería
  duplicar lo que Sentry Performance ya cubre. Si además se quiere,
  Vercel Analytics/Speed Insights (activables desde el panel de Vercel, sin
  código) cubren Web Vitals del lado del cliente.

Verificado en este Sprint corriendo la suite completa de tests: se puede ver
la duración real de cada tool (`FIND_SERVICE`, `SEARCH_AVAILABILITY`,
`CREATE_APPOINTMENT`, etc.) y el `requestId` del webhook/cron apareciendo en
los logs de una corrida real, no solo revisando el código.

## Qué NO cubre esto todavía

- **Alertas** (Slack/email cuando algo falla) — se configuran en el panel de
  Sentry una vez que el proyecto existe, no es código de este repo.
- **Uptime monitoring** (¿está la app arriba en absoluto?) — Sentry reporta
  errores dentro de la app corriendo, no si el servidor no responde en
  absoluto. Un servicio separado (UptimeRobot, Better Uptime, el propio
  healthcheck del proveedor de hosting) cubre ese caso; no está configurado.
- **Dashboards de negocio** (cuántas reservas hoy, etc.) — eso ya existe
  dentro de la propia app (`/dashboard/analytics`, Sprint 23), no es parte
  de Sentry.

## Costo de agregar esto

Medido en este Sprint, no estimado: el bundle compartido de First Load JS
subió de 102 kB a 184 kB, y el bundle de Middleware de 34 kB a 99 kB, al
agregar los SDKs de cliente/edge de Sentry. Es un costo real de performance
a cambio de visibilidad de errores — ver la sección de Performance del
Production Readiness Report para el análisis completo y si vale la pena
ajustar qué se manda al cliente (ej. deshabilitar el tracing del cliente y
quedarse solo con captura de errores, que pesa bastante menos).
