#!/usr/bin/env bash
# Refresca la base de QA con una copia anonimizada de producción.
#
#   pg_dump de producción (solo lectura) → pg_restore en QA → anonimizar.sql → verificar.sql
#
# Lo corre José, nunca un agente. Origen: POSTGRES_URL de .env.prod. Destino: POSTGRES_URL
# de .env (QA). Ambas son la conexión directa (DATABASE_URL puede ser Accelerate y psql no
# la entiende).
#
# Guardas antes de escribir nada:
#   - QA_URL vacío, igual a PROD_URL, con "prod" en el texto, o mismo destino
#     (host + puerto + usuario + base) que producción → aborta.
#   - La base de QA debe tener la tabla marca public.qa_entorno y producción no.
#     Crearla una sola vez en la base de QA recién creada:
#       psql "$QA_URL" -c 'CREATE TABLE public.qa_entorno (creada timestamptz NOT NULL DEFAULT now())'
#     (Prisma Postgres usa el mismo host db.prisma.io para todas las bases, así que el host
#     solo no distingue QA de producción; la marca sí.)
#   - Muestra ambos destinos y pide escribir "qa".
#
# Cliente de PostgreSQL: pg_dump no puede volcar un servidor de versión mayor que la suya.
# Si producción es más nueva, instalar el cliente que corresponda (p. ej. postgresql-client-17)
# o apuntar a sus binarios: PG_BIN=/usr/lib/postgresql/17/bin scripts/qa-refresh.sh
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

fallar() {
  echo "ABORTADO: $*" >&2
  exit 1
}

# --- Lectura de .env sin ejecutarlo -----------------------------------------------------

# Imprime el valor de la última línea NOMBRE=... del archivo (sin comillas ni "export").
leer_var() {
  local archivo="$1" nombre="$2" linea valor
  [[ -f "$archivo" ]] || return 0
  linea="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${nombre}=" "$archivo" | tail -n 1 || true)"
  [[ -n "$linea" ]] || return 0
  valor="${linea#*=}"
  valor="${valor%$'\r'}"
  valor="${valor%"${valor##*[![:space:]]}"}"
  if [[ "$valor" == \"*\" || "$valor" == \'*\' ]]; then
    valor="${valor:1:${#valor}-2}"
  fi
  printf '%s' "$valor"
}

# Partes de una URL postgres(ql)://usuario:clave@host:puerto/base?params
url_resto() { local r="${1#*://}"; r="${r%%\?*}"; printf '%s' "$r"; }
url_host() {
  local r; r="$(url_resto "$1")"; r="${r##*@}"; r="${r%%/*}"; r="${r%%:*}"
  printf '%s' "${r,,}"
}
url_puerto() {
  local r; r="$(url_resto "$1")"; r="${r##*@}"; r="${r%%/*}"
  if [[ "$r" == *:* ]]; then printf '%s' "${r##*:}"; else printf '5432'; fi
}
url_usuario() {
  local r; r="$(url_resto "$1")"
  if [[ "$r" == *@* ]]; then r="${r%@*}"; printf '%s' "${r%%:*}"; fi
}
url_base() {
  local r; r="$(url_resto "$1")"; r="${r##*@}"
  if [[ "$r" == */* ]]; then printf '%s' "${r#*/}"; else printf 'postgres'; fi
}
# Huella corta del usuario: distingue destinos en el mismo host sin mostrar credenciales.
huella() { printf '%s' "$1" | sha256sum | cut -c1-8; }

PROD_URL="$(leer_var .env.prod POSTGRES_URL)"
QA_URL="$(leer_var .env POSTGRES_URL)"

[[ -f .env.prod ]] || fallar "no existe .env.prod (origen: producción)."
[[ -n "$PROD_URL" ]] || fallar "POSTGRES_URL está vacío en .env.prod."
[[ -n "$QA_URL" ]] || fallar "POSTGRES_URL de QA (.env) está vacío: no hay destino."
[[ "${QA_URL,,}" != *prod* ]] || fallar "la URL de QA contiene \"prod\": parece producción."
[[ "$QA_URL" != "$PROD_URL" ]] || fallar "la URL de QA es idéntica a la de producción."

PROD_HOST="$(url_host "$PROD_URL")"
QA_HOST="$(url_host "$QA_URL")"
[[ -n "$PROD_HOST" && -n "$QA_HOST" ]] || fallar "no se pudo leer el host de alguna URL."

PROD_DESTINO="$(url_usuario "$PROD_URL")@$PROD_HOST:$(url_puerto "$PROD_URL")/$(url_base "$PROD_URL")"
QA_DESTINO="$(url_usuario "$QA_URL")@$QA_HOST:$(url_puerto "$QA_URL")/$(url_base "$QA_URL")"
[[ "$QA_DESTINO" != "$PROD_DESTINO" ]] ||
  fallar "QA apunta a la misma base que producción (host $QA_HOST, mismo usuario y base)."

echo "Origen  (producción, solo lectura): host $PROD_HOST · base $(url_base "$PROD_URL") · usuario #$(huella "$(url_usuario "$PROD_URL")")"
echo "Destino (QA, se BORRA y se reemplaza): host $QA_HOST · base $(url_base "$QA_URL") · usuario #$(huella "$(url_usuario "$QA_URL")")"
if [[ "$QA_HOST" == "$PROD_HOST" ]]; then
  echo "Aviso: mismo host. Es normal en Prisma Postgres (db.prisma.io); la marca qa_entorno decide."
fi

respuesta=""
read -r -p 'Escribe qa para continuar: ' respuesta || true
[[ "$respuesta" == "qa" ]] || fallar "no se confirmó con \"qa\"."

# --- Hash de la contraseña común de QA --------------------------------------------------

qa_password_hash=""
read -r -s -p 'Hash bcrypt de la contraseña de QA (no se muestra): ' qa_password_hash || true
echo
[[ "$qa_password_hash" =~ ^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$ ]] ||
  fallar "eso no parece un hash bcrypt (\$2b\$10\$ + 53 caracteres)."

# --- Herramientas y versiones -----------------------------------------------------------

PG_BIN="${PG_BIN:-}"
PG_DUMP="${PG_BIN:+$PG_BIN/}pg_dump"
PG_RESTORE="${PG_BIN:+$PG_BIN/}pg_restore"
PSQL="${PG_BIN:+$PG_BIN/}psql"
for herramienta in "$PG_DUMP" "$PG_RESTORE" "$PSQL"; do
  command -v "$herramienta" >/dev/null || fallar "no se encontró $herramienta (instalar postgresql-client o definir PG_BIN)."
done

version_mayor() { "$1" --version | grep -Eo '[0-9]+(\.[0-9]+)?' | head -n 1 | cut -d. -f1; }
CLIENTE_DUMP="$(version_mayor "$PG_DUMP")"
CLIENTE_RESTORE="$(version_mayor "$PG_RESTORE")"
[[ "$CLIENTE_DUMP" == "$CLIENTE_RESTORE" ]] ||
  fallar "pg_dump ($CLIENTE_DUMP) y pg_restore ($CLIENTE_RESTORE) son de versiones distintas; usar PG_BIN."

# Consultas de solo lectura (no escriben en ninguna de las dos bases).
consultar() { "$PSQL" -X -At -v ON_ERROR_STOP=1 -c "$2" "$1"; }

SERVIDOR_PROD="$(consultar "$PROD_URL" 'show server_version_num')"
SERVIDOR_QA="$(consultar "$QA_URL" 'show server_version_num')"
MAYOR_PROD=$((SERVIDOR_PROD / 10000))
MAYOR_QA=$((SERVIDOR_QA / 10000))
echo "PostgreSQL: cliente $CLIENTE_DUMP · producción $MAYOR_PROD · QA $MAYOR_QA"
((MAYOR_QA >= MAYOR_PROD)) ||
  echo "Aviso: QA ($MAYOR_QA) es más vieja que producción ($MAYOR_PROD); el restore puede fallar."
((CLIENTE_DUMP >= MAYOR_PROD)) ||
  fallar "pg_dump $CLIENTE_DUMP no puede volcar un servidor $MAYOR_PROD. Instalar postgresql-client-$MAYOR_PROD o correr con PG_BIN=/usr/lib/postgresql/$MAYOR_PROD/bin."

MARCA_SQL="select to_regclass('public.qa_entorno') is not null"
[[ "$(consultar "$QA_URL" "$MARCA_SQL")" == "t" ]] ||
  fallar "la base destino no tiene la marca public.qa_entorno: no se reconoce como QA. Si de verdad es la base de QA, crear la marca (ver cabecera del script)."
[[ "$(consultar "$PROD_URL" "$MARCA_SQL")" == "f" ]] ||
  fallar "la base de origen tiene la marca public.qa_entorno: el origen parece ser QA, no producción."

# --- Copia ------------------------------------------------------------------------------

TMP_DIR="$(mktemp -d)"
DUMP="$TMP_DIR/prod.dump"
RESTAURADA=0
COMPLETO=0
limpiar() {
  rm -rf "$TMP_DIR"
  if ((RESTAURADA == 1 && COMPLETO == 0)); then
    echo "" >&2
    echo "!!! ATENCIÓN: la base de QA puede tener DATOS REALES sin anonimizar." >&2
    echo "!!! Volver a correr este script, o vaciar la base de QA antes de usarla." >&2
  fi
}
trap limpiar EXIT
trap 'exit 130' INT TERM

echo "1/4 pg_dump de producción…"
"$PG_DUMP" --no-owner --no-privileges -Fc -f "$DUMP" "$PROD_URL"

echo "2/4 pg_restore en QA…"
RESTAURADA=1
RESTORE_OK=1
if ! "$PG_RESTORE" --clean --if-exists --no-owner -d "$QA_URL" "$DUMP"; then
  # Aunque falle, se anonimiza lo que sí se restauró: no dejar datos reales en QA.
  RESTORE_OK=0
  echo "pg_restore terminó con errores (ver arriba); se anonimiza igual lo restaurado." >&2
fi

echo "3/4 Anonimizando…"
# El hash entra por un -f previo con \set (printf es builtin: no aparece en `ps`).
"$PSQL" -X -q -v ON_ERROR_STOP=1 \
  -f <(printf '\\set qa_password_hash %s\n' "'$qa_password_hash'") \
  -f prisma/sql/qa/anonimizar.sql \
  "$QA_URL"

echo "4/4 Verificando…"
RESULTADO="$("$PSQL" -X -At -F '|' -v ON_ERROR_STOP=1 -f prisma/sql/qa/verificar.sql "$QA_URL")"
if command -v column >/dev/null; then
  printf '%s\n' "$RESULTADO" | column -t -s '|'
else
  printf '%s\n' "$RESULTADO"
fi
FALLAS="$(printf '%s\n' "$RESULTADO" | awk -F'|' 'NF != 2 || $2 !~ /^[0-9]+$/ || $2 != 0 { n++ } END { print n + 0 }')"
FILAS="$(printf '%s\n' "$RESULTADO" | grep -c '|' || true)"
((FILAS > 0)) || fallar "verificar.sql no devolvió chequeos."
((FALLAS == 0)) || fallar "$FALLAS chequeo(s) de anonimización no dieron 0 (ver tabla)."

COMPLETO=1
((RESTORE_OK == 1)) ||
  fallar "QA quedó anonimizada, pero pg_restore tuvo errores: la copia puede estar incompleta."
echo "Listo: QA refrescada y anonimizada."
