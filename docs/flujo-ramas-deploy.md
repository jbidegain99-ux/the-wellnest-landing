# Flujo de ramas y despliegue: QA → producción

Diseño y motivos: `docs/superpowers/specs/2026-10-23-flujo-qa-produccion-design.md`.

```
feat/x ──PR──▶ develop ──(deploy QA)──▶ PR "release" ──José aprueba──▶ main ──(deploy prod)
hotfix/y ──PR──▶ main ──▶ merge main → develop (mismo día)
```

- `develop` = QA, `https://qa.wellneststudio.net`. `main` = producción, `https://wellneststudio.net`.
- Vercel solo construye `main` y `develop`. El `ignoreCommand` de `vercel.json` omite cualquier otra rama, y también un deploy sin metadatos de git (por ejemplo, desde la CLI).
- GitHub Actions (`.github/workflows/ci.yml`, job `checks`) corre en cada PR a `main` y `develop` y en push a ambas: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Debe estar en verde para mergear.
- Quién hace qué: José mergea PRs y corre todo lo que toca la base de producción. Claude prepara ramas, PRs y scripts, y nunca mergea una promoción.

## Feature

1. `git switch develop && git pull`, luego `git switch -c feat/<tema>` (o `fix/`, `docs/`, `chore/`).
2. Trabaja, commitea, `git push -u origin feat/<tema>`. No se crea preview de la rama.
3. Abre un PR a `develop` con la plantilla (`.github/pull_request_template.md`). Espera `checks` en verde y mergea.
4. Vercel despliega `develop` en QA. Prueba ahí (José / Adriana) antes de promover.
5. Si el cambio trae SQL manual (`prisma/sql/*.sql`): José lo corre primero en la base de QA con la `POSTGRES_URL` de QA, y lo prueba en QA.

## Promoción a producción

1. Todo lo que va a promoverse ya está probado en `https://qa.wellneststudio.net`.
2. Lista lo que sube: `git log origin/main..origin/develop --oneline`.
3. Abre un PR `develop` → `main` titulado "release: …". La descripción incluye:
   - el resultado de `git log origin/main..origin/develop --oneline`;
   - qué se probó en QA y quién lo probó (José / Adriana);
   - el SQL manual pendiente para producción, si hay.
4. Si hay SQL pendiente: José lo corre en producción justo antes de mergear, con la `POSTGRES_URL` de producción (`.env.prod`).
5. José mergea con merge commit (sin squash). Eso es su visto bueno. Vercel despliega producción.
6. Verifica el invariante (sección abajo).

## Hotfix

1. `git switch main && git pull`, luego `git switch -c hotfix/<tema>`.
2. PR a `main` con CI en verde; José mergea.
3. El mismo día: PR de `main` a `develop` (merge, no squash) para que `develop` tenga el arreglo. Nunca se deja `main` con commits que `develop` no tenga.
4. Verifica el invariante.

## Si QA falla

Se arregla en `develop` con un PR `fix/*`, nunca directo en `main`. El PR de promoción se actualiza solo con los commits nuevos de `develop`. Si lo roto ya está en producción, es un hotfix.

## Invariante

```
git fetch origin
git rev-list --no-merges --count origin/develop..origin/main
```

Debe dar `0` (los merge commits de promoción no cuentan). Si da más, `main` tiene commits que `develop` no tiene: fusiona `main` en `develop` por PR.

## Refrescar QA

QA es una copia anonimizada de producción. Lo corre José, no Claude.

1. Requiere `.env.prod` (origen) y `.env` con la `POSTGRES_URL` directa de QA (destino).
2. `scripts/qa-refresh.sh`: `pg_dump` de producción (lectura) → `pg_restore` en QA → `prisma/sql/qa/anonimizar.sql` → `prisma/sql/qa/verificar.sql`. Muestra ambos destinos y pide escribir `qa`; luego pide el hash bcrypt de la contraseña de QA.
3. Marca de QA: la base de QA debe tener la tabla `public.qa_entorno`. Se crea una sola vez, en QA, nunca en producción:
   ```
   psql "$QA_URL" -c 'CREATE TABLE public.qa_entorno (creada timestamptz NOT NULL DEFAULT now())'
   ```
   El script aborta si QA no la tiene o si producción sí. Prisma Postgres usa el mismo host para todas las bases, por eso el host solo no distingue QA de producción.
4. Versión del cliente: `pg_dump` no puede volcar un servidor de versión mayor. Si producción es más nueva, instala el cliente correspondiente o usa `PG_BIN=/usr/lib/postgresql/<N>/bin scripts/qa-refresh.sh`.
5. Si `verificar.sql` no da 0 en todos los chequeos, el script falla y QA puede tener datos reales: vuelve a correrlo antes de usar QA.

## Scripts: local = QA, producción a propósito

- Sin señal, `scripts/loadEnv.ts` carga `.env` y `.env.local` (QA). Importa `./loadEnv` de primero en cada script.
- Contra producción: `WELLNEST_ENV=prod npx tsx scripts/<x>.ts`. Carga solo `.env.prod` e imprime `*** PRODUCCIÓN — base <host> ***`. Si falta `.env.prod`, el script termina con error. Un `.env.prod` presente sin la señal nunca se carga.
- Prefiere `WELLNEST_ENV=prod` sobre `--prod`: `--prod` también funciona (`src/lib/envFiles.ts`), pero rompe scripts que leen `argv[2]`.
- `.env.prod` debe estar completo. Si falta una variable, Prisma puede completarla desde el `.env` de QA y mezclar entornos.
- Los scripts contra producción los corre José (auditorías mensuales, lista de seguimiento, reportes). Nunca `prisma db push` contra ninguna base.

## Variables por entorno

| Variable | QA (`develop`) | Producción (`main`) |
|---|---|---|
| `APP_ENV` | `qa` (franja "QA", noindex y robots; ver nota) | sin definir |
| `DATABASE_URL` / `POSTGRES_URL` | base de QA (Accelerate / directa) | base de producción |
| `QA_ACCESS_PASSWORD` | contraseña de QA (Basic Auth del sitio) | sin definir |
| `QA_EMAIL_ALLOWLIST` | correos de José y Adriana: reciben el suyo | sin definir |
| `QA_EMAIL_SINK` | casilla de prueba de José; recibe el resto | sin definir |
| `PAYWAY_ENV` | `TEST`, con credenciales de prueba | producción |
| `PAYWAY_CALLBACK_PUBLIC_BASE_URL` | `https://qa.wellneststudio.net` | dominio de producción |
| `FACTURADOR_SV_API_URL` | QA de Facturo, o vacío (facturación deshabilitada) | producción de Facturo |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | propios de QA | propios de producción |
| `CRON_SECRET`, `BOOTSTRAP_SECRET`, `PAYWAY_CALLBACK_SECRET`, `FACTURADOR_SV_WEBHOOK_SECRET` | distintos de producción | los de producción |

- En Vercel, las variables de QA son scope Preview filtrado a la rama `develop`. Cárgalas con `printf`, sin salto de línea.
- `APP_ENV=qa` debe estar disponible también en build: el scope Preview → `develop` cubre build y runtime. La franja, el noindex y los robots se hornean en las páginas estáticas durante el build; sin `APP_ENV` al construir, esas páginas salen sin ellos.
- En QA los correos pasan por `routeQaEmail` (`src/lib/qaEmail.ts`): destinatarios de `QA_EMAIL_ALLOWLIST` reciben el suyo; el resto va a `QA_EMAIL_SINK`; el asunto lleva `[QA → destinatario-original]`. Sin sink, los no permitidos no se envían.
- `src/lib/qaGate.ts` pide la contraseña en todo QA, salvo callbacks de PayWay (`/api/payments/payway/callback`, `/api/payments/payway/denied`), el webhook de Facturo (`/api/webhooks/facturador`), `/api/cron/`, `/_next/`, `/images/` y archivos de `public` como `/robots.txt` y `/favicon.ico`.
- Los crons de `vercel.json` solo corren en producción; en QA se prueban a mano llamando al endpoint con el `CRON_SECRET` de QA.
