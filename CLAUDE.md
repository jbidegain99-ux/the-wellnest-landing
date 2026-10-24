# Wellnest — reglas del repo

Pasos detallados en `docs/flujo-ramas-deploy.md`. Las reglas globales de bases de datos (`~/.claude/CLAUDE.md`) también aplican aquí.

## Ramas
- `develop` = QA (`qa.wellneststudio.net`). `main` = producción (`wellneststudio.net`).
- `feat/*`, `fix/*`, `docs/*`, `chore/*` salen de `develop` y vuelven a `develop` por PR.
- `hotfix/*` sale de `main`, va a `main` por PR y el mismo día se fusiona `main` → `develop`.
- Nunca hagas push a `main` ni a `develop`; todo entra por PR con CI (`checks`) en verde.
- A `main` solo entra `develop` mediante un PR de promoción ("release: …"), con merge commit (sin squash). Claude no mergea PRs de promoción: lo hace José.
- Invariante: `git rev-list --no-merges --count origin/develop..origin/main` = 0.
- Vercel solo despliega `main` y `develop`.

## Bases de datos
- Nunca `prisma db push` (borra el índice único parcial anti-duplicados de producción).
- SQL manual (`prisma/sql/*.sql`): primero en QA, después en producción justo antes de mergear la promoción que lo necesita.
- La base de producción, el SQL en producción y el refresco de QA (`scripts/qa-refresh.sh`) los corre solo José, nunca Claude.
- La tabla marca `public.qa_entorno` existe solo en la base de QA; nunca se crea en producción.

## Entorno local
- `.env` y `.env.local` apuntan a QA (con `APP_ENV=qa`). Producción está en `.env.prod` y no se carga sola.
- "Local = QA" rige una vez hecho el paso de `.env` de la puesta en marcha (plan, Task 9 Step 6). Antes, el `.env` local sigue siendo producción sin `APP_ENV=qa`, y `scripts/loadEnv.ts` aborta todo script en modo por defecto; no le agregues `APP_ENV=qa` a un `.env` que apunta a producción.
- Un script contra producción se pide a propósito: `WELLNEST_ENV=prod npx tsx scripts/<x>.ts` (mejor que `--prod`, que rompe scripts que leen `argv[2]`). Eso lo decide José, no Claude.
- CLI de Prisma contra producción: solo lectura y solo José, cargando `.env.prod` a mano (ver runbook). Nunca `prisma db push`.
- Scripts: importa `./loadEnv` de primero (tsx no lee `.env.local`).
- `scripts/` está fuera de `tsconfig`: `tsc` no lo valida; ejecútalos tras cambiar firmas en `src/lib`.
- En QA (`APP_ENV=qa`) los correos se desvían y PayWay va en TEST; nunca apuntes QA a servicios reales. El código lo refuerza: `PAYWAY_ENV=PROD` hace fallar el pago y un Facturo distinto de `api-qa.facturoelectronicosv.com` deshabilita la facturación.
