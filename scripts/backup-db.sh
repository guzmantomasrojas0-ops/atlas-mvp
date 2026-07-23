#!/usr/bin/env bash
# Backup manual/portable de la base de ATLAS.
#
# Este script es la red de seguridad "provider-agnostic": funciona igual
# contra el Postgres local de desarrollo o contra cualquier Postgres remoto
# (managed o self-hosted) mientras tengas la connection string. En
# producción sobre un proveedor managed (Neon, Supabase, Vercel Postgres,
# RDS), la estrategia PRINCIPAL de backup es la automática + PITR del
# proveedor (ver docs/operations/BACKUP.md) — esto es el respaldo B,
# portable entre proveedores y verificable a mano.
#
# Uso:
#   DATABASE_URL="postgresql://user:pass@host:port/db" ./scripts/backup-db.sh
#   ./scripts/backup-db.sh "postgresql://user:pass@host:port/db"
#
# Produce un dump en formato custom de pg_dump (-Fc): comprimido y
# restaurable selectivamente con pg_restore (no es un .sql plano).
set -euo pipefail

CONN_STRING="${1:-${DATABASE_URL:-}}"
if [ -z "$CONN_STRING" ]; then
  echo "Error: pasá la connection string como argumento o en DATABASE_URL." >&2
  exit 1
fi

# El DATABASE_URL de la app (ver .env.example) trae `?schema=public&options=...`
# para Prisma. `schema` no es un parámetro válido para libpq (pg_dump/pg_restore
# lo rechazan con "invalid URI query parameter") — se saca acá para que puedas
# pasar el mismo DATABASE_URL de siempre sin tener que armar uno aparte a mano.
# Orden importa: primero el caso "schema es el primer param de varios",
# después "es el único param", por último "está más adelante" — cualquier
# otro orden deja un `&` o `?` colgando y rompe la URI.
CONN_STRING="$(echo "$CONN_STRING" \
  | sed -E 's/\?schema=[^&]*&/?/' \
  | sed -E 's/\?schema=[^&]*$//' \
  | sed -E 's/&schema=[^&]*//')"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/atlas-mvp-$TIMESTAMP.dump"

echo "Iniciando backup -> $OUT_FILE"
pg_dump "$CONN_STRING" --format=custom --no-owner --no-privileges --file="$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "Backup completo: $OUT_FILE ($SIZE)"

# Verificación mínima (no un restore completo, ver restore-db.sh para eso):
# confirma que el archivo es un dump válido de pg_dump antes de darlo por bueno.
pg_restore --list "$OUT_FILE" > /dev/null
echo "Verificado: el archivo es un dump de pg_dump válido (pg_restore --list lo pudo leer)."
