# Backups

Estrategia de backup de la base de datos de ATLAS — qué se respalda, con qué
frecuencia, y cómo se prueba que un backup realmente sirve.

## Principio: dos capas, no una

**Capa 1 (principal, automática): backups + PITR del proveedor de Postgres
managed.** Una vez que ATLAS esté desplegado sobre un Postgres managed
(Neon, Supabase, Vercel Postgres, Amazon RDS, etc. — ver
[DEPLOYMENT.md](./DEPLOYMENT.md) para la elección), **esa es la defensa
principal**, no este script. Todos esos proveedores ofrecen:

- Backups automáticos diarios (o más frecuentes) sin configuración adicional.
- **PITR (Point-in-Time Recovery)**: restaurar la base a cualquier segundo
  dentro de la ventana de retención (típicamente 7-30 días según plan), no
  solo al momento del último snapshot. Esto importa porque un incidente real
  casi nunca coincide con la hora exacta de un backup nocturno — PITR permite
  volver a "un segundo antes del error", no "anoche a las 3am".
- Replicación/almacenamiento redundante del backup en sí (no vive en el mismo
  disco que la base).

**Acción concreta al desplegar**: activar backups automáticos + PITR en el
panel del proveedor elegido. Es un checkbox/configuración, no código — está
en el checklist de [DEPLOYMENT.md](./DEPLOYMENT.md).

**Capa 2 (respaldo manual, portable, verificado en este repo):
`scripts/backup-db.sh` / `scripts/restore-db.sh`.** Un dump de `pg_dump` en
formato custom, restaurable con `pg_restore` contra cualquier Postgres —
managed o no. Sirve para:

- Un snapshot manual antes de una migración riesgosa o un cambio grande.
- Portabilidad si en algún momento se cambia de proveedor.
- Verificación independiente de que "sí se puede reconstruir la base desde
  cero" sin depender de la consola del proveedor.

No reemplaza la Capa 1 — un cron casero corriendo `pg_dump` en un servidor
sin monitoreo es exactamente el tipo de "backup que nadie prueba hasta que
ya es tarde" que este documento existe para evitar.

## Cómo usar los scripts

```bash
# Backup — usa el mismo DATABASE_URL que ya tenés en .env
export DATABASE_URL="postgresql://user:pass@host:5432/atlas_mvp?schema=public&options=-c%20TimeZone%3DUTC"
./scripts/backup-db.sh
# -> ./backups/atlas-mvp-<timestamp>.dump
```

```bash
# Restore — exige tipear el nombre de la base destino para confirmar
./scripts/restore-db.sh ./backups/atlas-mvp-20260723T203921Z.dump \
  "postgresql://user:pass@host:5432/atlas_mvp_staging"
```

Notar: el script pela automáticamente el parámetro `schema=` de la
connection string antes de pasársela a `pg_dump`/`pg_restore` — esas
herramientas usan libpq directo y no entienden ese parámetro (es específico
de Prisma), a diferencia de `options=-c TimeZone=UTC` que sí es válido para
libpq y se deja tal cual.

`backup-db.sh` también corre `pg_restore --list` sobre el archivo generado
como chequeo mínimo de integridad (que el archivo sea un dump válido) —
no reemplaza una prueba de restore completa, ver más abajo.

## Prueba de restauración — ejecutada y verificada en este Sprint

Esto no es una afirmación sin probar. Se ejecutó realmente:

1. Se sembraron datos reales de ejemplo (`npx prisma db seed`): 1 negocio,
   1 usuario, 2 servicios, 2 miembros de equipo, 4 clientes, 4
   conversaciones, 10 mensajes.
2. `./scripts/backup-db.sh` contra `atlas_mvp` → dump de 40 KB.
3. `./scripts/restore-db.sh` contra una base nueva y vacía
   (`atlas_mvp_restore_test`).
4. Se compararon los `count(*)` de cada tabla entre origen y destino:
   **coinciden exactamente** (1/1/2/2/4/4/10).
5. Se verificó contenido real, no solo conteos: el nombre del negocio
   ("Barbería El Buen Corte") y el email del dueño (`owner@example.com`)
   sobrevivieron intactos en la base restaurada.

Conclusión: el mecanismo de backup/restore funciona de punta a punta contra
Postgres 17. Lo que **no** está probado todavía es un restore de PITR contra
un proveedor managed específico — eso depende de cuál se elija en
[DEPLOYMENT.md](./DEPLOYMENT.md), y debe probarse una vez elegido, antes del
primer cliente real (ver checklist en el informe final).

## Frecuencia recomendada

- **PITR del proveedor**: continuo (WAL streaming) — no requiere decisión,
  viene con el plan.
- **Backup manual (`scripts/backup-db.sh`)**: antes de cada migración de
  schema en producción, y opcionalmente una vez por semana como snapshot
  portable adicional. Para el volumen de datos de un solo negocio de
  servicios (el dump de prueba de este Sprint: 40 KB con datos de ejemplo),
  el costo de correrlo más seguido es insignificante.

## Qué NO cubre esto

- Backups de secretos/variables de entorno (`ANTHROPIC_API_KEY`,
  `WHATSAPP_*`, `CRON_SECRET`) — esos viven en el gestor de secretos del
  proveedor de hosting (ver [DEPLOYMENT.md](./DEPLOYMENT.md)), no en la base
  de datos, y su "backup" es simplemente tenerlos documentados/reproducibles.
- Backup del código — eso es lo que soluciona tener git con historial real
  en GitHub (ver el hallazgo de este Sprint: 9 días de trabajo vivían solo
  en un disco antes de esto).
