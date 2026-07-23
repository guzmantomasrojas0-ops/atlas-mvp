#!/usr/bin/env bash
# Restaura un dump generado por scripts/backup-db.sh contra una base destino.
#
# Deliberadamente exige que confirmes el nombre de la base destino tipeándolo
# — un restore es destructivo (--clean recrea los objetos) y la forma más
# común de desastre acá es correr esto apuntando por error a producción. No
# hay bandera para saltear esta confirmación.
#
# Uso:
#   ./scripts/restore-db.sh <archivo.dump> "<connection-string-destino>"
set -euo pipefail

DUMP_FILE="${1:-}"
CONN_STRING="${2:-}"

if [ -z "$DUMP_FILE" ] || [ -z "$CONN_STRING" ]; then
  echo "Uso: ./scripts/restore-db.sh <archivo.dump> <connection-string-destino>" >&2
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: no existe el archivo '$DUMP_FILE'." >&2
  exit 1
fi

# Extrae el nombre de la base del final de la connection string para
# mostrarlo en la confirmación (mejor esfuerzo, no un parser completo de URIs).
DB_NAME="$(echo "$CONN_STRING" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"

echo "Vas a RESTAURAR '$DUMP_FILE' contra la base '$DB_NAME'."
echo "Esto reemplaza el contenido de esa base (--clean --if-exists)."
echo "Escribí el nombre exacto de la base ('$DB_NAME') para confirmar:"
read -r CONFIRMATION

if [ "$CONFIRMATION" != "$DB_NAME" ]; then
  echo "No coincide. Cancelado — no se tocó nada." >&2
  exit 1
fi

pg_restore \
  --dbname="$CONN_STRING" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE"

echo "Restore completo contra '$DB_NAME'."
