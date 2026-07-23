# Runbook

Procedimientos operativos puntuales — tareas de "hacer una vez" o "hacer
cuando pase X", a diferencia de `RECOVERY.md` (qué hacer cuando algo se
rompió) o `MONITORING.md`/`SECURITY.md` (referencia de cómo está configurado
algo).

## Activar branch protection en GitHub (pendiente — requiere acceso al repo)

El pipeline de CI (`.github/workflows/ci.yml`) corre en cada push y PR contra
`master`, pero **por sí solo no bloquea un merge** — eso lo hace GitHub a
nivel de configuración del repositorio ("branch protection rules"), no el
archivo del workflow. Esta es la única pieza de FASE 1 (CI/CD) que no se
pudo automatizar desde acá: requiere credenciales de owner del repo
(`gh auth login` con un token, o la consola web de GitHub) que este entorno
no tiene ni debe pedir.

Pasos (una sola vez, ~2 minutos, desde la cuenta dueña del repo):

1. En GitHub: **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `master`.
3. Activar **"Require status checks to pass before merging"**.
4. Buscar y marcar el check **"Typecheck, lint, tests, build"** (el nombre
   del job en `ci.yml`) como requerido.
5. (Recomendado) Activar también **"Require branches to be up to date before
   merging"** para evitar mergear sobre un base desactualizado.
6. Guardar.

Alternativa por CLI, si en algún momento hay un `gh` autenticado a mano:

```bash
gh api repos/guzmantomasrojas0-ops/atlas-mvp/branches/master/protection \
  -X PUT \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]="Typecheck, lint, tests, build" \
  -f enforce_admins=true \
  -f required_pull_request_reviews=null \
  -f restrictions=null
```

Hasta que se active esto, el pipeline corre y reporta el resultado en cada
push/PR (ver la pestaña _Actions_ del repo), pero un merge con CI en rojo
todavía es posible manualmente — el gate es informativo, no obligatorio,
hasta este paso.

## Reseed de datos de ejemplo en desarrollo

```bash
npx prisma db seed
```

Idempotente: si ya existe el negocio de ejemplo, no duplica nada (ver
`prisma/seed.ts`).

## Rotar `CRON_SECRET`

1. Generar un valor nuevo (ej. `openssl rand -hex 32`).
2. Actualizarlo en las variables de entorno del hosting (Vercel u otro).
3. Si el cron lo dispara Vercel Cron, no hace falta tocar nada más — Vercel
   inyecta el header automáticamente desde la misma variable.
4. Si lo dispara un cron externo (ver README, sección de notificaciones),
   actualizar ese cron con el nuevo valor.

## Ver el estado de un run de CI

```bash
curl -s "https://api.github.com/repos/guzmantomasrojas0-ops/atlas-mvp/actions/runs" | head -50
```

O directamente en `https://github.com/guzmantomasrojas0-ops/atlas-mvp/actions`.
