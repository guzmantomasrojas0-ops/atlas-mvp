# Seguridad

Estado real de la postura de seguridad de ATLAS — qué está implementado y
verificado, qué se intentó y no se pudo cerrar, y qué queda como riesgo
documentado. Auditoría hecha en este Sprint releyendo el código real, no una
checklist genérica.

## Autenticación y sesiones

- Contraseñas: hasheadas con bcrypt (`src/modules/auth/domain/password.ts`),
  nunca en texto plano — verificado en el test de `createOwnerAccount`.
- Tokens de sesión: el valor que recibe el navegador (`atlas_session`) nunca
  se guarda tal cual en la base — se guarda su hash
  (`hashSessionToken`, `src/modules/auth/domain/session-token.ts`); un dump de
  la tabla `sessions` no permite reconstruir tokens válidos.
- Cookie de sesión (`src/lib/session.ts`): `httpOnly: true` (no accesible
  desde JS, mitiga robo por XSS), `secure` en producción, `sameSite: "lax"`,
  `maxAge` 30 días.
- Rate limiting de login: 5 intentos fallidos / 15 min por email
  (`src/modules/auth/domain/rate-limiter.ts`, Sprint 24). **Limitación
  conocida y documentada, no descubierta ahora**: es un `Map` en memoria del
  proceso — en un despliegue serverless con múltiples instancias (Vercel), no
  comparte estado entre invocaciones. Es una primera capa real, no una
  solución completa; ver recomendaciones de v2.
- Logout borra la sesión server-side (no solo la cookie del cliente).

## Autorización (RBAC)

Tres roles (`OWNER`, `MANAGER`, `STAFF`, `src/modules/auth/domain/types.ts`),
con las reglas centralizadas en `src/modules/auth/domain/permissions.ts` (no
repetidas por Server Action):

- `canManagePayments` / `canManageCatalog`: `OWNER` o `MANAGER`.
- `canManageUsers`: solo `OWNER`.

El mecanismo que las hace cumplir es `requireRole()`
(`src/lib/session.ts`) — verificado que efectivamente se usa en los Server
Actions de pagos, catálogo (servicios/equipo) y en crear/reprogramar/cancelar
reservas (`src/app/dashboard/*/actions.ts`), no solo declarado.

## Aislamiento multi-tenant

Cada fila de datos de negocio lleva `businessId`, y todo repositorio filtra
por él — no existe una query "global" entre negocios. Cubierto por
`tests/integration/tenant-isolation.test.ts` (Sprint 22): confirma que un
usuario de un negocio no puede leer ni escribir datos de otro.

## Inyección SQL

Prisma como ORM en todo el código de aplicación — sin concatenación de
strings en queries. Hay 5 usos de `$queryRaw`/`$executeRaw`
(`analytics-repository.ts`, `conversation-repository.ts`) para agregaciones
que el query builder de Prisma no expresa bien (agrupar por día en una zona
horaria, `UPDATE` de un solo campo) — **todos son tagged templates
parametrizados** (`` db.$queryRaw`... WHERE "businessId" = ${businessId}` ``),
no `$queryRawUnsafe`/`$executeRawUnsafe` con concatenación. Verificado
leyendo los 5 sitios uno por uno en este Sprint, no asumido por "usa Prisma".

## XSS

Sin `dangerouslySetInnerHTML` en todo `src/` (verificado con grep en este
Sprint) — React escapa por default en todos lados. No hay renderizado de
HTML/Markdown de origen externo (mensajes de WhatsApp/clientes se muestran
como texto plano).

## CSRF

Next.js Server Actions verifican el header `Origin` contra el host de la
request automáticamente (protección nativa del framework, no código de este
repo) — una Server Action invocada desde un origen distinto se rechaza antes
de ejecutar cualquier lógica.

## SSRF

Único `fetch()` server-side con URL parcialmente dinámica:
`src/modules/messaging/adapters/whatsapp/client.ts` — el host
(`graph.facebook.com`) está hardcodeado, solo el `phoneNumberId` (config de
negocio, no input directo de un request) se interpola en el path. No hay
ningún endpoint que acepte una URL arbitraria de un usuario y la use para un
fetch server-side.

## Webhooks y Cron

- Webhook de WhatsApp: valida firma HMAC-SHA256 (`X-Hub-Signature-256`)
  contra `WHATSAPP_APP_SECRET` antes de procesar cualquier evento — un
  payload con firma inválida se descarta y se loguea, nunca se procesa
  (`api/webhooks/whatsapp/route.ts`).
- `POST /api/cron/notifications`: exige `Authorization: Bearer $CRON_SECRET`.
  Sin `CRON_SECRET` configurado, falla cerrado (`500`, no ejecuta nada) — no
  hay una ruta donde "falta configuración" signifique "abierto a cualquiera".

## Secretos y variables de entorno

- Ningún secreto committeado — `.env*` en `.gitignore` salvo `.env.example`
  (que no tiene valores reales, solo placeholders vacíos con comentarios).
- Todas las credenciales externas (Anthropic, WhatsApp, Sentry) fallan **al
  usarse**, no al arrancar — evita que falte una y tumbe toda la app.
- **Hallazgo de este Sprint, corregido**: `prisma/seed.ts` no tenía ninguna
  guarda contra correr en producción — crea una cuenta `OWNER` con contraseña
  fija (`atlas-dev-2026`, ya documentada públicamente en este mismo repo). Se
  agregó un chequeo de `NODE_ENV=production` que cancela el seed con un
  mensaje explícito. Ver `docs/operations/DEPLOYMENT.md`, checklist del
  primer deploy.

## Cabeceras HTTP de seguridad

Agregadas en este Sprint vía `next.config.ts`:

- `X-Frame-Options: DENY` — bloquea que la app se embeba en un `<iframe>` de
  otro sitio (clickjacking).
- `X-Content-Type-Options: nosniff` — evita que el navegador reinterprete el
  tipo de un archivo servido.
- `Referrer-Policy: strict-origin-when-cross-origin` — no filtra la URL
  completa (con paths/query) a sitios de terceros al navegar afuera.
- `Permissions-Policy` — deshabilita cámara, micrófono, geolocalización,
  pagos y USB (ninguno lo usa la app).
- `Strict-Transport-Security` — fuerza HTTPS una vez que el dominio lo sirve.

Las 5 se verificaron con un build de producción real (`next build && next
start`) y la suite completa de Playwright pasando sin regresiones.

### Content-Security-Policy — intentada, NO incluida (hallazgo importante)

Se probó una CSP completa (`default-src 'self'`, `script-src`/`style-src`
con `'unsafe-inline'` — el mismo trade-off del ejemplo oficial de Next.js,
dado que Framer Motion escribe estilos inline y no se generó un nonce para no
volver a inflar el bundle de Middleware, ver `MONITORING.md`;
`connect-src 'self' https://*.sentry.io`; `object-src 'none'`;
`base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`;
`upgrade-insecure-requests`).

**Rompe funcionalidad real, verificado dos veces**:

1. En `next dev`: el formulario de login cae a un `GET` nativo del navegador
   con la contraseña en la query string (`/login?email=...&password=...`) en
   vez de invocar la Server Action por `POST` — reproducido de forma
   consistente con un A/B test limpio (con CSP: falla 2/2; sin CSP: funciona
   1/1).
2. Contra un build de producción real (`next build && next start`, lo mismo
   que corre Playwright y lo mismo que despliega Vercel): la suite completa
   de E2E mostró 1 falla dura y 2 fallas intermitentes, las tres en el mismo
   patrón — "agregar servicio", "agregar miembro del equipo" y "confirmar un
   pago" ejecutan la Server Action pero la actualización optimista de la UI
   nunca llega.

Se intentó aislar la directiva responsable sacando `upgrade-insecure-requests`
y `form-action 'self'` por separado — ninguno de los dos, por sí solo, fue la
causa; con el resto de las directivas activas el problema persiste. Sospecha
más probable, no confirmada: alguna interacción entre el SDK de cliente de
Sentry (que instrumenta `fetch`/`XHR` globalmente para tracing) y
`connect-src`, pero confirmarlo requiere una sesión real de Chrome DevTools
inspeccionando el error exacto de CSP en consola — herramienta que este
entorno de desarrollo no tiene disponible de forma confiable (ver limitación
de la pestaña de navegador en el resto de este Sprint).

**Decisión**: no enviar una CSP a medio probar que le rompería el login o el
alta de servicios a un cliente real. Queda como el ítem de seguridad más
importante pendiente antes de escalar — ver recomendaciones de v2 y el
Production Readiness Report. Cuando se retome, hacerlo en un ambiente con
DevTools real (no este), agregando una directiva a la vez y confirmando cada
una contra la suite completa de Playwright antes de sumar la siguiente.

## Qué NO se auditó en este Sprint (alcance no cubierto)

- Dependencias de terceros (`npm audit` reporta 7 vulnerabilidades — 3
  moderate, 4 high — no se investigó cada una individualmente ni se corrió
  `npm audit fix`, que podría introducir breaking changes sin verificar).
  Ver Production Readiness Report.
- Un pentest real (intentos activos de explotación) — esto es una revisión de
  código, no una prueba de penetración.
- Uploads de archivos — no existen en la app hoy (ni servicios, ni fotos de
  perfil, ni adjuntos), así que no hay superficie que auditar ahí todavía.
