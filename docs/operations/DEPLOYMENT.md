# Despliegue — Vercel + Neon PostgreSQL

Guía paso a paso para el primer despliegue de ATLAS a producción, y para
cualquier despliegue posterior. Nada acá se asume: cada paso se verificó
contra el código real de este repo (build, migraciones, límites de
plataforma) durante este Sprint — donde algo no se pudo verificar de punta a
punta por no haber cuentas reales de Vercel/Neon/Meta/Sentry conectadas, se
dice explícitamente.

## Arquitectura de producción

| Pieza              | Proveedor                            | Rol                                                                                           |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Frontend + backend | [Vercel](https://vercel.com)         | Next.js 15 (App Router), Server Actions, Route Handlers, Cron.                                |
| Base de datos      | [Neon](https://neon.tech) PostgreSQL | Managed Postgres serverless — pooling + PITR incluidos.                                       |
| ORM                | Prisma 7 (`@prisma/adapter-pg`)      | Ver la nota sobre pooled vs. direct URL más abajo — es la parte no obvia de esta combinación. |
| IA                 | Anthropic (Claude)                   | `AI_PROVIDER=anthropic`.                                                                      |
| Mensajería         | WhatsApp Cloud API (Meta)            | Webhook de entrada + envío saliente.                                                          |
| Monitoreo          | Sentry                               | Errores de cliente + servidor (no Edge — ver `MONITORING.md`).                                |
| Logs               | pino (estructurado, JSON)            | Se leen desde los logs nativos de Vercel, o desde Sentry si hay DSN.                          |

## Prerrequisitos

Cuentas necesarias antes de empezar: Vercel, Neon, y (si se usa WhatsApp/IA/monitoreo reales) Anthropic Console, Meta for Developers, Sentry. Ninguna de estas se pudo crear ni verificar desde este entorno de desarrollo — los pasos de abajo describen exactamente qué hacer en cada una, pero ejecutarlos requiere que una persona con esas credenciales los siga.

## Paso 1 — Neon: crear el proyecto y las dos connection strings

1. Crear una cuenta/proyecto en [neon.tech](https://neon.tech). Elegir una región cercana a donde esté la mayoría de los negocios clientes (latencia de cada query del dashboard/agente depende de esto).
2. Neon da **dos** cadenas de conexión para la misma base — esto es la parte fácil de pasar por alto:
   - **Pooled connection** (el hostname incluye `-pooler`): pensada para runtime con muchas conexiones concurrentes cortas — exactamente el patrón de funciones serverless de Vercel. **Esta va en `DATABASE_URL`.**
   - **Direct connection** (sin `-pooler`): conexión directa a Postgres, sin PgBouncer en el medio. **Esta va en `DIRECT_DATABASE_URL`.**
3. **Por qué importa la distinción**: `src/lib/db.ts` abre su propio `pg.Pool` vía `@prisma/adapter-pg` en cada invocación serverless — sin el pooler de Neon del lado del servidor, el número de conexiones directas a Postgres escala con el tráfico y agota el límite de conexiones de Neon rápido. Pero `prisma migrate deploy` (que corre en cada build, ver Paso 3) necesita la conexión **directa**: las sentencias DDL de una migración no son confiables corriendo a través de un pooler en modo transacción (el modo que usa PgBouncer). Este proyecto ya está preparado para esta separación — ver `prisma.config.ts`, que usa `DIRECT_DATABASE_URL` si existe y cae en `DATABASE_URL` si no (así el desarrollo local, sin pooling, sigue funcionando sin cambios).
4. Activar backups automáticos + PITR desde el panel de Neon (plan-dependiente — confirmar la ventana de retención del plan elegido). Ver [BACKUP.md](./BACKUP.md) para por qué esta es la Capa 1 de la estrategia de backup, no el script manual de este repo.
5. Guardar ambas cadenas — se usan en el Paso 2.

**No verificado en este Sprint**: no hay cuenta de Neon conectada a este entorno. Todo lo de arriba está descrito según la arquitectura documentada de Neon (pooled endpoint vía PgBouncer, direct endpoint, PITR por plan), no probado contra un proyecto Neon real. Verificarlo con el primer deploy real es parte del checklist del Informe de Production Readiness.

## Paso 2 — Vercel: proyecto y variables de entorno

1. Importar este repositorio de GitHub en Vercel ([vercel.com/new](https://vercel.com/new)). Vercel detecta Next.js automáticamente — no hace falta tocar el Build Command ni el Output Directory.
2. **Antes de disparar el primer deploy**, cargar todas las variables de entorno que apliquen (Project Settings → Environment Variables, scope "Production"):

   | Variable                                                                                            | Valor                                                                                                               |
   | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                                                                      | La cadena **pooleada** de Neon (Paso 1).                                                                            |
   | `DIRECT_DATABASE_URL`                                                                               | La cadena **directa** de Neon (Paso 1).                                                                             |
   | `AI_PROVIDER`                                                                                       | `anthropic`                                                                                                         |
   | `ANTHROPIC_API_KEY`                                                                                 | De [console.anthropic.com](https://console.anthropic.com/).                                                         |
   | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | De Meta for Developers — ver Paso 5.                                                                                |
   | `CRON_SECRET`                                                                                       | Generar uno (`openssl rand -hex 32`) — lo usan tanto el cron de Vercel como el workflow de GitHub Actions (Paso 6). |
   | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                                                              | De Sentry — ver Paso 7. Opcional.                                                                                   |
   | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`                                                 | De Sentry — opcional, solo para source maps.                                                                        |

   **No incluir `SHADOW_DATABASE_URL`** — solo la usa `prisma migrate dev` (generar migraciones nuevas), un comando que nunca corre en producción.

3. Por qué el orden importa: el Build Command (`npm run build`) ya incluye `prisma migrate deploy` (ver Paso 3) — si el primer deploy dispara antes de que `DATABASE_URL`/`DIRECT_DATABASE_URL` existan, el build falla ahí, no silenciosamente después.

## Paso 3 — El build ya aplica las migraciones (nada manual)

`package.json` está configurado así (verificado en este Sprint, no una descripción de intención):

```json
"postinstall": "prisma generate",
"build": "prisma migrate deploy && next build"
```

- `postinstall` corre en cada `npm install` — necesario porque `src/generated/prisma` está en `.gitignore` (nunca se versiona) y sin esto, un checkout fresco (exactamente lo que hace Vercel en cada deploy) rompe el build con `Module not found: Can't resolve '@/generated/prisma/client'`. **Esto se reprodujo y se confirmó en este Sprint**: se borró el cliente generado y se corrió `npm run build` solo, que falló con ese error exacto — el fix (`postinstall`) se verificó reproduciendo el checkout fresco de nuevo y confirmando que ahora sí genera el cliente antes del build.
- `prisma migrate deploy` corre antes de `next build` en cada deploy — aplica cualquier migración pendiente contra `DIRECT_DATABASE_URL` (o `DATABASE_URL` si la primera no está definida). No hace falta ejecutar nada a mano contra la base de producción.

No hay ningún paso de "correr las migraciones" separado en este checklist porque no lo necesita — es exactamente el problema estructural que se corrigió en este Sprint (antes de esto, no había ni `postinstall` ni migración automática en el build; ambos se agregaron y verificaron acá).

## Paso 4 — Dominio, DNS, SSL

1. Vercel Project Settings → Domains → agregar el dominio propio.
2. Vercel muestra los registros DNS exactos a crear en el proveedor de dominio (un registro `A` a una IP de Vercel, o un `CNAME` a `cname.vercel-dns.com` — el valor exacto lo da el panel de Vercel en el momento, no un valor fijo para documentar acá).
3. SSL es automático: Vercel emite y renueva el certificado (Let's Encrypt) en cuanto el DNS resuelve correctamente — no requiere ninguna acción manual de certificados.
4. Tiempo de propagación DNS: minutos a 48 horas según el proveedor de dominio — Vercel reintenta la verificación automáticamente, no hace falta re-disparar nada.

**No verificado en este Sprint**: no hay un dominio real ni cuenta de Vercel conectada. Pasos según el comportamiento estándar y documentado de Vercel.

## Paso 5 — Webhook de WhatsApp Cloud API

Requiere la URL real de producción (post-deploy), así que este paso va después del primer deploy exitoso.

1. En [Meta for Developers](https://developers.facebook.com/), la app que ya tiene permiso `whatsapp_business_messaging` → WhatsApp → Configuration.
2. Callback URL: `https://tu-dominio/api/webhooks/whatsapp`.
3. Verify Token: el mismo valor que `WHATSAPP_VERIFY_TOKEN` en Vercel — Meta hace un `GET` de verificación con ese token antes de aceptar la suscripción (`src/app/api/webhooks/whatsapp/route.ts` ya implementa ese handshake).
4. Suscribirse al campo de webhook `messages`.
5. Confirmar que `WHATSAPP_APP_SECRET` en Vercel es el App Secret real de esa app — sin esto, cada webhook entrante se rechaza por firma inválida (comportamiento esperado, falla cerrado — ver `MONITORING.md`/logs).

**Limitación conocida, no una tarea de este paso**: Meta solo permite texto libre dentro de la ventana de 24h de servicio al cliente (desde el último mensaje del cliente). Un recordatorio/agradecimiento automático que caiga fuera de esa ventana necesita una plantilla pre-aprobada por Meta — no implementado todavía, ver el Informe de Production Readiness.

## Paso 6 — Activar las notificaciones automáticas (cron)

Ver también la sección de notificaciones del [README](../../README.md).

1. `vercel.json` ya declara un cron diario (`0 10 * * *`) — es un respaldo, no el mecanismo principal. **No cambiarlo a una frecuencia mayor sin confirmar el plan de Vercel**: el plan Hobby limita cualquier cron a como máximo una corrida por día, y un schedule más frecuente hace fallar el deploy directamente (verificado contra la documentación vigente de Vercel en este Sprint, no una suposición).
2. El mecanismo principal es `.github/workflows/notifications-cron.yml` (cada 15 minutos, gratis en un repo público). Activarlo:
   - GitHub → este repo → Settings → Secrets and variables → Actions.
   - Pestaña **Variables**: crear `PRODUCTION_URL` = `https://tu-dominio` (sin barra final).
   - Pestaña **Secrets**: crear `CRON_SECRET` con el mismo valor que en Vercel.
3. Correrlo una vez a mano (Actions → Notifications Cron → Run workflow) para confirmar que responde `200` antes de confiar en el schedule automático.

## Paso 7 — Sentry (opcional pero recomendado)

Ver [MONITORING.md](./MONITORING.md) para el detalle completo — resumen operativo:

1. Crear proyecto Next.js en [sentry.io](https://sentry.io).
2. Cargar `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (mismo valor) en Vercel.
3. Opcional: `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` para subir source maps.
4. Redeploy. Sin esto, la app funciona idéntico — Sentry queda deshabilitado (`enabled: Boolean(dsn)`), no es un bloqueante de despliegue.

## Checklist del primer deploy (orden real, no aspiracional)

1. [ ] Neon: proyecto creado, ambas connection strings guardadas, PITR activado.
2. [ ] Vercel: repo importado, TODAS las variables de entorno de la tabla del Paso 2 cargadas (antes del primer build).
3. [ ] Deploy disparado — confirmar en los logs de build de Vercel que `prisma migrate deploy` corrió y `next build` terminó sin errores.
4. [ ] Login con una cuenta creada vía el flujo real de Business Setup (**nunca** `npx prisma db seed` contra producción — ver la guarda agregada en `prisma/seed.ts` este Sprint, que ahora se niega a correr si `NODE_ENV=production`).
5. [ ] Dominio propio + SSL confirmado (candado en el navegador).
6. [ ] Webhook de WhatsApp registrado en Meta y confirmado con un mensaje real de prueba.
7. [ ] `PRODUCTION_URL`/`CRON_SECRET` configurados en GitHub Actions, workflow corrido a mano una vez con éxito.
8. [ ] Sentry conectado (opcional) — generar un error a propósito y confirmar que aparece en el dashboard de Sentry (esto no se pudo hacer en este Sprint por no haber cuenta conectada; es el primer paso pendiente post-deploy).
9. [ ] Un backup manual (`scripts/backup-db.sh`) contra la base de producción recién poblada, para confirmar que el script también funciona contra Neon (se verificó contra Postgres local en `BACKUP.md`, no todavía contra Neon específicamente).

## Rollback

Ver [RECOVERY.md, Escenario C](./RECOVERY.md#escenario-c-deploy-roto-en-producción) — Vercel guarda deploys anteriores; volver al último deploy sano desde el panel de Vercel es casi siempre más rápido que diagnosticar en caliente. Si el deploy roto ya corrió una migración de schema irreversible, el rollback de código no revierte la base — evaluar compatibilidad hacia atrás antes de decidir.
