# ATLAS

Empleado digital para negocios locales (barberías, salones, clínicas). Ver [PLAN.md](./PLAN.md) para la arquitectura original, el roadmap por fases y las decisiones de diseño de partida.

**Estado actual: Sprint 24 — Production Hardening.** El producto está funcionalmente completo para su primer release (v1.0): autenticación multi-negocio, catálogo (servicios/equipo), calendario de reservas con anti-doble-reserva, pagos manuales (Zelle), conversaciones multicanal con un agente de IA que puede agendar/consultar/reprogramar por sí solo, WhatsApp Cloud API real, recordatorios automáticos, y un dashboard de Analytics. Este sprint no agrega funcionalidad nueva — audita y endurece lo que ya existe (base de datos, IA, seguridad, performance, UX/accesibilidad, limpieza y esta misma documentación). Ver el **Informe de Production Readiness** (pedido al final de este sprint) para el estado honesto, riesgos y deuda técnica conocida.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router, Server Components + Server Actions) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) (Select) + [Framer Motion](https://www.framer.com/motion/) (microinteracciones) — tema oscuro/glassmorphism
- [Prisma 7](https://www.prisma.io/) (`@prisma/adapter-pg`) + PostgreSQL
- [Zod](https://zod.dev/) + [React Hook Form](https://react-hook-form.com/) para formularios
- [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — el agente de IA (Claude) que conversa con clientes finales y ejecuta acciones reales
- [bcryptjs](https://www.npmjs.com/package/bcryptjs) — hash de contraseñas
- [pino](https://getpino.io/) — logging estructurado
- [Vitest](https://vitest.dev/) (unit/integración) + [Playwright](https://playwright.dev/) (E2E)
- ESLint + Prettier

## Requisitos

- Node.js 20+ (probado con Node 24)
- Una base de datos PostgreSQL accesible (local o remota). Este proyecto se desarrolla contra PostgreSQL 17 instalado como servicio de Windows — ver [Entorno de base de datos](#entorno-de-base-de-datos-postgresql-local).

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar el archivo de entorno y ajustar la cadena de conexión a tu Postgres:

   ```bash
   cp .env.example .env
   ```

   Ver [Variables de entorno](#variables-de-entorno) más abajo para el detalle de cada una — el propio `.env.example` documenta inline por qué existe cada variable y qué pasa si falta.

3. Generar el cliente de Prisma y aplicar el schema:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. (Opcional pero recomendado) Cargar datos de ejemplo — un negocio, una cuenta Owner, servicios, equipo y conversaciones de demostración:

   ```bash
   npm run prisma:seed
   ```

   Credenciales de la cuenta de ejemplo: ver `prisma/seed.ts` (`ensureOwnerAccount`). El seed es idempotente — correrlo de nuevo no duplica datos, solo completa lo que falte.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000). Sin sesión activa, cualquier ruta de `/dashboard` redirige a `/login`.

## Variables de entorno

| Variable | Obligatoria | Qué hace |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a Postgres. Debe incluir `options=-c%20TimeZone%3DUTC` — sin esto, `Timestamptz` se lee/escribe corrido por el offset de la sesión (ver comentario en `.env.example`). En producción sobre un proveedor con connection pooling (Neon, Supabase), esta debe ser la cadena **pooleada** — la usa el runtime de la app. |
| `DIRECT_DATABASE_URL` | Solo en producción con pooling | Cadena de conexión **directa** (sin pooler), usada solo por `prisma migrate deploy` — las migraciones no son confiables a través de un pooler en modo transacción. Sin definir, cae en `DATABASE_URL` (correcto en local, donde no hay pooling). Ver [docs/operations/DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md). |
| `SHADOW_DATABASE_URL` | Sí en desarrollo (para `prisma migrate dev`) | Base vacía separada que Prisma usa para calcular diffs de migración nueva. `migrate deploy` (lo que corre en CI/producción) no la usa — no hace falta en Vercel. |
| `AI_PROVIDER` | No (default `"openai"`) | `"openai" \| "anthropic" \| "gemini"`. Solo `"anthropic"` está implementado de verdad hoy — los otros dos devuelven una respuesta simulada. |
| `ANTHROPIC_API_KEY` | Solo si `AI_PROVIDER="anthropic"` | Key de [console.anthropic.com](https://console.anthropic.com/). Sin ella, el provider tira `MissingCredentialsError` recién al usarse, no al arrancar. |
| `WHATSAPP_ACCESS_TOKEN` | Solo para WhatsApp real | Token de la app de Meta (permiso `whatsapp_business_messaging`). |
| `WHATSAPP_PHONE_NUMBER_ID` | Solo para WhatsApp real | El "Phone Number ID" del número conectado. |
| `WHATSAPP_VERIFY_TOKEN` | Solo para WhatsApp real | String propio, usado en el handshake `GET` del webhook. |
| `WHATSAPP_APP_SECRET` | Solo para WhatsApp real | Valida la firma HMAC-SHA256 (`X-Hub-Signature-256`) que Meta manda en cada webhook — sin esto no se puede confirmar que un webhook realmente vino de Meta. |
| `CRON_SECRET` | Sí, en cuanto haya notificaciones en producción | Autentica `POST /api/cron/notifications`. Sin configurar, el endpoint responde `500` y no ejecuta nada (falla cerrado). |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | No | Monitoreo de errores. Sin definir, `Sentry.init` queda deshabilitado (no rompe nada, no es obligatorio para desarrollar). Ver [docs/operations/MONITORING.md](./docs/operations/MONITORING.md). |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | No | Solo para que el build suba source maps a Sentry. Sin `SENTRY_AUTH_TOKEN`, ese paso se salta automáticamente. |

Todas las credenciales externas (Anthropic, WhatsApp) fallan **al usarse**, no al arrancar la app — así el resto del sistema sigue funcionando aunque un proveedor no esté configurado todavía.

## Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run format` | Formatea todo el repo con Prettier |
| `npm run format:check` | Verifica formato sin modificar archivos |
| `npm run typecheck` | Chequeo de tipos de TypeScript (`tsc --noEmit`) |
| `npm run test` | Tests unitarios/integración (Vitest). Corre los archivos de test en serie (`fileParallelism: false`) — los tests de integración comparten una sola base Postgres viva, y correr archivos en paralelo permite que uno cuente/mute una tabla mientras otro está a mitad de su propio before/after. |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:e2e` | Tests E2E (Playwright) — levanta un build de producción y corre contra Chromium con un solo worker, por la misma razón de estado compartido contra una sola base. |
| `npm run prisma:generate` | Regenera el cliente de Prisma a partir del schema |
| `npm run prisma:migrate` | Crea y aplica una migración (`migrate dev`) |
| `npm run prisma:db-push` | Sincroniza el schema directo a la base, sin generar migración |
| `npm run prisma:seed` | Carga el negocio/cuenta/catálogo/conversaciones de ejemplo (`prisma/seed.ts`) — idempotente |
| `npm run prisma:studio` | Abre Prisma Studio |

**Antes de dar por cerrado cualquier cambio**: correr `typecheck`, `lint`, `test` y `test:e2e` — nunca correr Vitest y Playwright **al mismo tiempo**, comparten la misma base Postgres y se pisan entre sí.

## Arquitectura y módulos

Cada módulo de `src/modules/` sigue el mismo patrón interno: `domain/` (tipos y lógica pura, sin I/O — testeable sin base de datos ni red), `data/` (repositorios Prisma), `service.ts` (orquesta domain + data, expone los casos de uso) e `index.ts` (única puerta de entrada pública — ningún módulo importa el `domain/` o `data/` interno de otro). Ver la sección 5 de [PLAN.md](./PLAN.md) para el resto de las convenciones.

| Módulo | Responsabilidad |
|---|---|
| `business` | El tenant (`Business`): alta y datos generales del negocio. |
| `auth` | Cuentas (`User`), login/logout, sesiones hasheadas, límite de intentos de login. |
| `catalog` | Servicios y miembros del equipo (alta + listado). |
| `scheduling` | El núcleo transaccional: calendario, disponibilidad, anti-doble-reserva (constraint `EXCLUDE` de Postgres, no solo un chequeo de aplicación), reprogramación, cancelación. |
| `payments` | Registro manual de pagos (hoy solo Zelle) — nunca procesa dinero real, solo lo registra. |
| `customer` | Vista de clientes finales (`Client`) y su historial. |
| `conversation` | Hilos de mensajes por cliente/canal, no leídos, envío manual desde el dashboard. |
| `messaging` | Adapta cada canal externo (hoy: WhatsApp Cloud API real; Console adapter para desarrollo) a/desde el modelo interno `Conversation`/`Message`. |
| `ai` | Abstrae el proveedor de LLM (`AI_PROVIDER`) detrás de una interfaz común; hoy Anthropic (Claude) es el único proveedor real. |
| `agent` | El agente conversacional: interpreta el mensaje del cliente, decide qué herramienta ejecutar (consultar disponibilidad, crear/reprogramar una reserva, etc.) y redacta la respuesta — ver [Flujo de una conversación](#flujo-de-una-conversación-con-el-agente). |
| `notifications` | Decide CUÁNDO enviar (recordatorio 24h/2h antes, agradecimiento después) y delega el envío a `messaging` — nunca duplica la llamada al proveedor. |
| `analytics` | Agregaciones de solo lectura sobre citas/pagos/conversaciones para el dashboard de Analytics. |

### Flujo de una conversación con el agente

1. Un mensaje entra por `messaging` (WhatsApp real, o el adapter de consola en desarrollo) y se guarda como `Message` dentro de una `Conversation`.
2. `agent` arma el contexto (negocio, catálogo, disponibilidad, historial reciente) y se lo pasa a `ai`, que llama a Claude con ese contexto más las herramientas disponibles (consultar disponibilidad, preparar resumen de reserva, crear cita, reprogramar, etc.).
3. Claude decide si responder directamente o invocar una herramienta. Las herramientas que escriben datos (crear/reprogramar una cita) pasan por las mismas validaciones de dominio que usa el dashboard (`scheduling`) — no hay un camino paralelo con reglas distintas.
4. La respuesta final (texto para el cliente) se guarda como `Message` con `sender: AGENT` y sale por el mismo canal que entró.

### Flujo de una reserva desde el Dashboard

`AppShell` (Server Component) → página de `/dashboard/appointments` (Server Component, trae citas + equipo + servicios) → `CalendarGrid`/`ReservationsExperience` (Client Components, interactividad) → Server Action (`createAppointmentAction`, `rescheduleAppointmentAction`, etc.) → `scheduling/service.ts` → Postgres. Las Server Actions que mutan datos devuelven el registro actualizado directamente — el cliente aplica el resultado a su propio estado en vez de pedirle al servidor que vuelva a mandar todo (`router.refresh()`), evitando un segundo round-trip innecesario.

### Autenticación y aislamiento por negocio (multi-tenant)

- Cada fila de negocio (`Appointment`, `Client`, `Conversation`, etc.) tiene su propio `businessId` — todo repositorio filtra por él; no existe una query "global" que cruce negocios.
- `middleware.ts` es el primer gate: corre en el Edge Runtime (sin Prisma) y solo verifica que exista la cookie de sesión, para redirigir rápido a `/login` sin tocar la base. La validación real —¿la sesión existe?, ¿venció?, ¿qué usuario/negocio es?— vive en `requireSession()` (`lib/session.ts`), que corre en Node y es el único punto que decide autorización de verdad.
- Las contraseñas se guardan hasheadas (bcrypt); el token de sesión tampoco se guarda en texto plano — solo su hash (`Session.tokenHash`), así una fuga de la base no alcanza para hacerse pasar por un usuario logueado.
- El login tiene un límite de 5 intentos fallidos por email en una ventana de 15 minutos (`auth/domain/rate-limiter.ts`). **Limitación conocida**: el contador vive en memoria del proceso (`Map`) — en un despliegue serverless con múltiples instancias, cada una tiene su propio contador, así que el límite real es "5 intentos por instancia", no 5 global. Es una primera capa de defensa razonable para un solo-negocio/instancia, no una solución completa; ver el Informe de Production Readiness para la recomendación de reemplazo (rate limiting centralizado, ej. Redis).

## Estructura del proyecto

```
src/
├── app/
│   ├── login/                     # Login (page + actions.ts)
│   ├── dashboard/                  # Todo detrás de sesión: overview, appointments,
│   │                                  payments, customers, services, staff, analytics,
│   │                                  conversations (+ [conversationId])
│   ├── api/
│   │   ├── webhooks/whatsapp/      # Webhook entrante de WhatsApp Cloud API (GET verify + POST)
│   │   └── cron/notifications/     # Disparador externo del scheduler de notifications/
│   ├── actions.ts                  # Server action createBusinessAction (Business Setup)
│   └── page.tsx                    # Business Setup: formulario o resumen del negocio
├── middleware.ts                   # Gate de sesión para /dashboard/*
├── modules/                        # business, auth, catalog, scheduling, payments,
│                                      customer, conversation, messaging, ai, agent,
│                                      notifications, analytics — ver tabla de arriba
├── components/
│   ├── ui/                         # Sistema de diseño: Button, Card, Input, Select,
│   │                                  FormField, Badge, Skeleton, Progress, EmptyState, Label
│   ├── layout/                     # AppShell, Sidebar (nav con ruta activa + focus states),
│   │                                  Header
│   ├── auth/                       # Formulario de login
│   └── dashboard/                  # Un componente/experiencia por página del dashboard
│                                      (calendario, tablas, paneles de detalle, formularios)
└── lib/                            # db.ts, config.ts, logger.ts, errors.ts, cn.ts,
                                       session.ts/session-cookie.ts, colors.ts, staff-colors.ts

prisma/
├── schema.prisma     # 12 modelos: Business, User, Session, StaffMember, Service, Client,
│                       Appointment, Payment, AppointmentNotification, Conversation,
│                       Message, ChannelMapping
├── migrations/        # historial versionado completo
└── seed.ts           # negocio + cuenta Owner + catálogo + conversaciones de ejemplo

tests/
├── unit/               # Vitest — lógica pura de cada módulo (sin red ni base de datos)
├── integration/         # Vitest — repositorios y servicios contra Postgres real
└── e2e/                 # Playwright — flujos completos en navegador, un spec por área
    (auth, business-setup, services, staff, appointments, payments, customers,
     conversations, dashboard, analytics, smoke)
```

Ver la sección 3 de [PLAN.md](./PLAN.md) para el árbol original y el razonamiento detrás de cada límite de módulo (algunos detalles de esa sección quedaron desactualizados a medida que el proyecto creció; esta sección del README es la fuente de verdad actual).

## Convenciones

Ningún módulo importa el `domain/` o `data/` interno de otro módulo — solo su `index.ts` público. Ver la sección 5 de [PLAN.md](./PLAN.md) para el resto de las convenciones de código.

## Entorno de base de datos (PostgreSQL local)

Este proyecto **no depende de `npx prisma dev`** (el Postgres temporal/embebido de Prisma). Se probó esa vía en un momento del desarrollo y resultó inestable para uso sostenido: perdía datos al reiniciarse, fallaba con `ERROR: prepared statement "sN" already exists`, y a veces no arrancaba por un lock file colgado. Se reemplazó por un **PostgreSQL 17 real, instalado como servicio de Windows**, con los datos en disco de forma persistente.

### Cómo está instalado

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --source winget --silent \
  --accept-package-agreements --accept-source-agreements \
  --override "--mode unattended --unattendedmodeui minimal --superpassword postgres --serverport 5432 --disable-components stackbuilder"
```

Esto instala PostgreSQL 17 como servicio de Windows (`postgresql-x64-17`, *Startup type* `Automatic` — arranca solo con el sistema), usuario `postgres` / contraseña `postgres`, puerto `5432`, datos en `C:\Program Files\PostgreSQL\17\data`. Las bases `atlas_mvp` y `atlas_mvp_shadow` se crearon una sola vez a mano (`CREATE DATABASE ...`) y quedan ahí de forma permanente.

### Si necesitás controlar el servicio manualmente

Iniciarlo, pararlo o reiniciarlo (`Start-Service` / `Stop-Service` / `Restart-Service postgresql-x64-17`) **requiere una terminal con permisos de administrador**. Si no tenés una a mano, `pg_ctl` funciona sin permisos elevados y opera directo sobre el directorio de datos:

```bash
"/c/Program Files/PostgreSQL/17/bin/pg_ctl.exe" status -D "/c/Program Files/PostgreSQL/17/data"
"/c/Program Files/PostgreSQL/17/bin/pg_ctl.exe" start  -D "/c/Program Files/PostgreSQL/17/data" -l "/c/Program Files/PostgreSQL/17/data/log/manual.log" -w
"/c/Program Files/PostgreSQL/17/bin/pg_ctl.exe" stop   -D "/c/Program Files/PostgreSQL/17/data" -m fast
```

**No mezcles los dos caminos a la vez** (Windows Service y `pg_ctl` manual): arrancar con uno mientras el otro ya tiene el postmaster corriendo contra el mismo directorio de datos falla al bindear el puerto (Postgres lo detecta y rechaza arrancar dos veces, así que no hay riesgo real de corrupción — pero si ves un error de "could not bind address", es señal de que ya hay una instancia arriba, no reinicies a ciegas).

**Si no tenés ninguna sesión con permisos de administrador a mano** (por ejemplo, en un entorno sandbox/remoto): `pg_ctl start`/`stop` de arriba funciona igual, sin pedir elevación, porque opera directo sobre el directorio de datos en vez de pasar por el Service Control Manager de Windows.

## Backups y recuperación ante fallos

**Estado actual: no hay backups automatizados.** Este es un entorno de desarrollo local sobre un único Postgres — aceptable para esta etapa, pero es deuda pendiente antes de manejar datos reales de un negocio. Mientras tanto:

- **Backup manual bajo demanda** (antes de una migración riesgosa, o simplemente como buena costumbre):

  ```bash
  "/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" -U postgres -d atlas_mvp -F c -f atlas_mvp_backup.dump
  ```

  Restaurar con `pg_restore -U postgres -d atlas_mvp --clean atlas_mvp_backup.dump`.
- **Antes de cualquier migración en un entorno con datos reales**: sacar el dump de arriba primero. `prisma migrate deploy` no tiene rollback automático — si una migración deja el schema en un estado inesperado, la única vía de vuelta es restaurar desde un backup previo.
- **En producción**: usar un proveedor de Postgres administrado (Neon, Supabase, RDS, etc.) con backups automáticos/point-in-time-recovery habilitados — no replicar el setup de Postgres local de este README para datos reales de clientes. Ver el Informe de Production Readiness para el detalle de esta recomendación.

### Por qué esto importa para los tests

Con un Postgres real y persistente: reiniciar no borra datos, `prisma migrate deploy`/`migrate dev` funcionan de punta a punta, y Vitest/Playwright no dependen de reintentos o reinicios para pasar en verde.

## Notificaciones automáticas (WhatsApp)

`notifications/` decide CUÁNDO enviar (recordatorio 24h antes, recordatorio 2h antes, agradecimiento después de la cita) y delega el envío en sí a `messaging/` — nunca duplica la llamada a la API de WhatsApp. No hay ningún proceso corriendo en segundo plano dentro de Next.js: quien dispara la corrida es un llamado externo a `POST /api/cron/notifications` con el header `Authorization: Bearer $CRON_SECRET`.

- **Disparador principal — GitHub Actions** (`.github/workflows/notifications-cron.yml`): corre cada 15 minutos, la granularidad real que necesitan los recordatorios de 24h/2h. No depende del plan de Vercel — gratis e ilimitado en un repo público. Se activa configurando la variable de repo `PRODUCTION_URL` (Settings → Secrets and variables → Actions → Variables) y el secreto `CRON_SECRET`; sin `PRODUCTION_URL`, el job se salta limpio (no falla).
- **Respaldo — Cron nativo de Vercel** (`vercel.json`): una corrida diaria, no cada 15 minutos. **Importante**: el plan Hobby de Vercel limita cualquier cron a como máximo una corrida por día — un schedule más frecuente ahí falla el deploy directamente, no solo se degrada (ver [docs/operations/DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md)). Es un respaldo de una sola pasada por si el workflow de GitHub Actions tuviera una interrupción, no el mecanismo principal.
- Correr ambos a la vez es seguro: `runDueNotifications` es idempotente (constraint único `appointmentId+type+targetAt` en `AppointmentNotification`), nunca duplica un envío ya resuelto.
- Cualquier otro cron externo puede invocar el mismo endpoint:
  ```bash
  curl -X POST https://tu-dominio/api/cron/notifications \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

Sin `CRON_SECRET` configurado, el endpoint responde `500` y no ejecuta nada (falla cerrado, no abierto). Los reintentos (hasta 3 intentos) y el manejo de reprogramaciones son responsabilidad de `notifications/domain/due-notifications.ts` — ver el comentario ahí para el razonamiento.

**Limitación conocida (WhatsApp)**: Meta solo permite enviar mensajes de plantilla fuera de la ventana de 24h de servicio al cliente; un recordatorio o agradecimiento que caiga fuera de esa ventana necesita una plantilla pre-aprobada por Meta, no texto libre. Ver el Informe de Production Readiness para el detalle.

## CI/CD

`.github/workflows/ci.yml` corre en cada push/PR contra `master`: typecheck,
lint, format check, chequeo de drift de schema, aplica migraciones contra una
base Postgres fresca, Vitest, build, y Playwright E2E completo. Ver
[docs/operations/RUNBOOK.md](./docs/operations/RUNBOOK.md) para el único paso
manual que falta (activar "require status checks" en la protección de la
rama — requiere acceso de owner al repo en GitHub, no se puede hacer desde
código).

## Despliegue (Vercel + Neon)

Guía paso a paso completa, con capturas de dónde sacar cada valor, en
[docs/operations/DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md). Resumen:

1. Crear el proyecto en [Neon](https://neon.tech) y guardar las dos cadenas
   de conexión que da (pooleada y directa — ver `DIRECT_DATABASE_URL` arriba).
2. Crear el proyecto en Vercel, importar este repo, y cargar TODAS las
   [variables de entorno](#variables-de-entorno) que apliquen antes del
   primer deploy (no después — `prisma migrate deploy` corre como parte del
   build, ver paso 3, y necesita `DATABASE_URL`/`DIRECT_DATABASE_URL` ya
   configuradas).
3. `npm run build` ya incluye `prisma migrate deploy` (ver `package.json`) —
   no es un paso manual aparte. `postinstall` corre `prisma generate`
   automáticamente en cada `npm install` (necesario: `src/generated/prisma`
   no se versiona en git).
4. Activar el workflow de notificaciones (`.github/workflows/notifications-cron.yml`)
   configurando la variable de repo `PRODUCTION_URL` con el dominio real.
5. Configurar el webhook de WhatsApp en Meta apuntando a
   `https://tu-dominio/api/webhooks/whatsapp`, y (opcional pero recomendado)
   crear el proyecto de Sentry — ambos con instrucciones exactas en
   `DEPLOYMENT.md`.

Ver también [docs/operations/BACKUP.md](./docs/operations/BACKUP.md) (backups
+ PITR), [RECOVERY.md](./docs/operations/RECOVERY.md) (qué hacer si algo se
rompe) y [MONITORING.md](./docs/operations/MONITORING.md) (Sentry,
observabilidad).

## Troubleshooting

| Síntoma | Causa probable / qué hacer |
|---|---|
| `could not bind address` al iniciar Postgres | Ya hay una instancia corriendo contra el mismo directorio de datos (Windows Service o `pg_ctl` manual) — no inicies la otra vía, revisá con `pg_ctl status` primero. |
| `ERROR: prepared statement "sN" already exists` | Señal de que se está usando `npx prisma dev` (el Postgres embebido) en vez del Postgres persistente de este README — no está soportado. |
| `500` en `POST /api/cron/notifications` | Falta `CRON_SECRET` en el entorno, o el header `Authorization` no matchea — es el comportamiento esperado (falla cerrado), no un bug. |
| Webhook de WhatsApp devuelve "firma inválida" | Falta o es incorrecto `WHATSAPP_APP_SECRET`, o el payload fue modificado en tránsito — revisar que el App Secret sea el de la app de Meta correcta. |
| El agente de IA responde con un error de credenciales | Falta `ANTHROPIC_API_KEY` con `AI_PROVIDER=anthropic`, o la key es inválida/sin crédito — el error (`MissingCredentialsError`) es explícito sobre cuál falta. |
| Vitest o Playwright fallan de forma intermitente/no reproducible | Lo más probable es que ambos se corrieron **al mismo tiempo** contra la misma base — no hacerlo nunca; correr uno, esperar que termine, correr el otro. |
| Un usuario queda bloqueado de login sin haber fallado 5 veces él mismo | En un despliegue con múltiples instancias, el rate limiter es por instancia (ver [limitación conocida](#autenticación-y-aislamiento-por-negocio-multi-tenant)) — no hay acción del lado del usuario, es deuda técnica conocida. |

## Próximos pasos

Ver el Informe de Production Readiness (Sprint 24) para el estado real de producción, riesgos, deuda técnica y las recomendaciones concretas para v2 — es la fuente de verdad actual sobre qué falta, en vez de la sección 8 de [PLAN.md](./PLAN.md), que describe el roadmap tal como se veía antes de empezar.
