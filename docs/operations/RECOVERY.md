# Recuperación ante fallos

Qué hacer cuando algo se rompió de verdad — desde "una migración salió mal"
hasta "perdimos la base". Complementa [BACKUP.md](./BACKUP.md) (qué backups
existen) y [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) (cómo comunicar el
incidente mientras se resuelve).

## Antes que nada: ¿cuál es el escenario?

| Síntoma | Escenario | Ir a |
|---|---|---|
| Una migración rompió datos o falló a mitad de camino | Corrupción/error de datos, la base sigue viva | [Escenario A](#escenario-a-corrupción-o-error-de-datos-la-base-sigue-viva) |
| La base no responde, el proveedor reporta una caída | Base inaccesible | [Escenario B](#escenario-b-base-inaccesible) |
| El proyecto en Vercel (o el host elegido) no bootea / build roto en prod | Deploy roto | [Escenario C](#escenario-c-deploy-roto-en-producción) |
| Se perdió o corrompió el repositorio de código | Pérdida de código | [Escenario D](#escenario-d-pérdida-de-código) |

## Escenario A: corrupción o error de datos, la base sigue viva

El caso típico: una migración o una acción manual dejó datos incorrectos,
pero Postgres sigue respondiendo.

1. **Parar el sangrado primero.** Si es una migración a medio aplicar,
   confirmar con `npx prisma migrate status` si quedó en un estado
   intermedio. Si el tráfico sigue escribiendo sobre datos corruptos, poner
   la app en modo mantenimiento (ver `DEPLOYMENT.md` — variable de entorno
   o página estática) antes de seguir.
2. **PITR es la primera opción, no el dump manual.** Si el proveedor managed
   tiene point-in-time recovery activado (ver `BACKUP.md`), restaurar a un
   segundo antes del incidente:
   - Identificar el timestamp exacto del error (logs de Sentry/observability,
     ver `MONITORING.md`).
   - Restaurar desde la consola del proveedor a ese punto — normalmente crea
     una base NUEVA (no sobrescribe la existente), lo cual es preferible:
     permite comparar antes de cortar sobre la base "buena".
   - Verificar los datos restaurados contra lo esperado antes de repuntar
     `DATABASE_URL` de producción a la base recuperada.
3. **Si no hay PITR** (managed sin esa opción, o todavía en el Postgres
   local): usar el backup manual más reciente con `scripts/restore-db.sh`
   contra una base nueva (nunca sobre la de producción directamente — ver
   paso siguiente).
   ```bash
   ./scripts/restore-db.sh ./backups/atlas-mvp-<timestamp>.dump \
     "postgresql://user:pass@host:5432/atlas_mvp_recovery"
   ```
4. **Nunca restaurar directo sobre la base de producción como primer paso.**
   Restaurar a una base nueva, verificar (conteos de filas, un par de
   registros reales — igual que se hizo en la prueba de restore de
   `BACKUP.md`), y recién ahí decidir cómo cortar sobre ella (repuntar
   `DATABASE_URL`, o migrar los datos faltantes desde la base rota a la
   buena si el incidente fue parcial).
5. **Postmortem breve**: qué pasó, por qué, qué cambia para que no vuelva a
   pasar (ej. una migración nueva debería probarse contra un clon de
   producción antes de `migrate deploy`, no solo contra un schema vacío).

## Escenario B: base inaccesible

1. Confirmar que es un problema del proveedor y no de la app (status page
   del proveedor, o intentar conectar con `psql` directo desde otra
   máquina).
2. Si es una caída del proveedor: esperar su resolución es correcto — no
   hay backup que sirva más rápido que el propio proveedor recuperando el
   servicio administrado.
3. Si la caída se extiende y hay RTO comprometido con clientes: evaluar
   restaurar el backup más reciente en un proveedor/región alternativa como
   medida temporal (esto es un plan de contingencia a decidir en
   `DEPLOYMENT.md` una vez elegido el proveedor final — no hay uno genérico
   que sirva para todos los proveedores).

## Escenario C: deploy roto en producción

1. **Rollback del deploy, no de la base**, primero. Vercel (y equivalentes)
   guardan deploys anteriores — volver al último deploy sano es casi
   siempre más rápido que diagnosticar en caliente.
2. Si el deploy roto ya corrió una migración de schema irreversible contra
   producción: el rollback de código no revierte la base. Evaluar si la
   migración nueva es compatible hacia atrás con el código anterior antes
   de decidir el rollback — si no lo es, hay que resolver el código hacia
   adelante en vez de retroceder.
3. Revisar el pipeline de CI (`.github/workflows/ci.yml`) — si este deploy
   pasó CI y aun así rompió producción, es una señal de que falta cobertura
   de test para ese caso; agregarla antes de cerrar el incidente.

## Escenario D: pérdida de código

Desde este Sprint, esto ya no depende de un solo disco: el historial
completo (12 commits agrupados por área, Sprints 1-24) vive en
`origin/master` en GitHub. Recuperación:

```bash
git clone https://github.com/guzmantomasrojas0-ops/atlas-mvp.git
```

Si además se perdió el propio repositorio de GitHub (cuenta comprometida,
repo borrado por error): la única defensa es un mirror/fork en otra cuenta u
otro proveedor — no configurado todavía, queda como recomendación en el
informe final (Production Readiness Report, sección de riesgos).

## Simulacro recomendado

Antes de tener el primer cliente real: correr el Escenario A completo una
vez contra un clon de staging (no contra producción), cronometrando cuánto
tarda de punta a punta. Eso da el RTO real del proyecto en vez de uno
estimado — ver el Production Readiness Report para por qué esto todavía no
se hizo contra un ambiente de staging real (no existe todavía, ver
`DEPLOYMENT.md`).
