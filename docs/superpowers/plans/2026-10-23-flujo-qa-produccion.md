# Flujo QA → producción — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo cambio pase por un entorno QA (`qa.wellneststudio.net`, rama `develop`, base propia anonimizada) antes de llegar a producción (`main`), sin que QA ni lo local toquen datos, correos, pagos o facturas reales.

**Architecture:** Un flag `APP_ENV=qa` (variables de Vercel scope Preview → rama `develop`, y `.env` local) activa en el código: desvío de correos, bloqueo con contraseña, `noindex` y franja de QA. Vercel solo despliega `main` y `develop`. Scripts locales caen en QA salvo señal explícita de producción. CI en GitHub Actions + protección de ramas cierran el flujo.

**Tech Stack:** Next.js 14 (App Router, middleware en Edge), next-auth 4, Prisma 5 + Prisma Postgres, Vitest 4, GitHub Actions, Vercel (Hobby), `pg_dump`/`pg_restore`/`psql`.

**Spec:** `docs/superpowers/specs/2026-10-23-flujo-qa-produccion-design.md`

## Global Constraints

- Nunca `prisma db push` contra ninguna base (borra el índice único parcial anti-duplicados hecho a mano).
- Claude no corre comandos destructivos ni nada contra producción: restaurar/anonimizar QA, SQL manual y `pg_dump` de prod los corre José (`!` en la sesión). Claude prepara y verifica.
- Variables de QA: `APP_ENV=qa`, `QA_ACCESS_PASSWORD`, `QA_EMAIL_SINK`, `QA_EMAIL_ALLOWLIST` (coma-separada; José y Adriana). En producción ninguna existe y el comportamiento no cambia.
- Correos desviados llevan asunto `[QA → <destinatarios originales>] <asunto>`.
- Franja: texto exacto `QA — no es el sitio real`.
- Dominio QA: `qa.wellneststudio.net`. Facturo QA: `https://api-qa.facturoelectronicosv.com` (o facturación deshabilitada con variables vacías).
- Rutas que el bloqueo de QA deja pasar: `/api/payments/payway/callback`, `/api/payments/payway/denied`, `/api/webhooks/facturador`, `/api/cron/*`, y assets de Next (`/_next/*`, `/favicon.ico`, imágenes estáticas).
- Valores con `printf` al cargarlos en Vercel (sin `\n`; incidente NEXTAUTH_URL 22-oct).
- `scripts/` está fuera de `tsconfig`: lo que tenga lógica va en `src/lib/` con test; los scripts solo lo importan.
- Commits en español, convención `tipo(alcance): …`, con la línea `Co-Authored-By` de la sesión.

## Review Focus

1. Producción sin variables de QA: el middleware nuevo no debe pedir contraseña ni cambiar redirecciones de `/perfil`, `/reservar`, `/carrito`, `/checkout`, `/admin` → test en Task 4.
2. `APP_ENV=qa` con `QA_EMAIL_SINK` vacío: ningún correo a destinatarios no permitidos sale → test en Task 3.
3. Destinatarios con mayúsculas/espacios (`Adriana_LLopez@Hotmail.com `) deben matchear la lista permitida → test en Task 3.
4. Script de refresco de QA apuntado por error a la base de producción como destino: debe abortar antes de tocar nada → guarda en Task 7.
5. `loadEnv` con `.env.prod` presente pero sin señal: jamás carga producción → test en Task 6.

---

### Task 1: Dejar `main` en verde (tests, lint, gitignore)

**Files:**
- Modify: `src/lib/schedule/classDates.test.ts:84-98`
- Create: `.eslintrc.json`
- Modify: `.gitignore`
- Modify (solo si lint marca errores): los archivos que señale

- [ ] **Step 1:** Correr `npx vitest run src/lib/schedule/classDates.test.ts`. Esperado: FAIL en "une patrón y fechas sueltas sin duplicar" y "ordena cronológicamente" (dependen de la fecha de hoy: `mergeDateSelection` descarta fechas pasadas).
- [ ] **Step 2:** En esos dos tests pasar `todayStr` fijo como tercer argumento: `'2026-09-01'`. No cambiar `classDates.ts`.
- [ ] **Step 3:** `npx vitest run` → esperado: todo PASS en un checkout limpio de `main`. (Los fallos de `instructorPaymentsGuests.test.ts` y el error de `tsc` en `add-attendee` vienen de archivos sin trackear de José: no tocarlos ni commitearlos. Verificar en un `git worktree` limpio.)
- [ ] **Step 4:** Crear `.eslintrc.json` con `{ "extends": "next/core-web-vitals" }`. Correr `npx next lint` → no debe abrir el asistente. Si hay errores (no warnings), corregirlos con el cambio mínimo; si alguno no tiene arreglo obvio, desactivar esa regla puntual con comentario de por qué, y listarlo en el PR.
- [ ] **Step 5:** `.gitignore`: reemplazar el bloque de env por `.env*` + `!.env.example`. Verificar: `git check-ignore -v .env.qa .env.prod` muestra la regla; `git status` no muestra archivos nuevos rastreados.
- [ ] **Step 6:** `npx tsc --noEmit` (en worktree limpio) → sin errores.
- [ ] **Step 7:** Commit `chore: tests sin depender de la fecha, config de eslint y .env* ignorados`.

### Task 2: CI en GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:** Workflow `CI`, disparadores `pull_request` a `main` y `develop`, y `push` a ambas. Un job `checks` en `ubuntu-latest`, Node 20, `npm ci` con caché, y pasos con estos nombres exactos (la protección de ramas los referencia): `Typecheck` (`npx tsc --noEmit`), `Lint` (`npm run lint`), `Tests` (`npm test`), `Build` (`npm run build`).
- [ ] **Step 2:** Variables del job para que el build no necesite base ni secretos reales: `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci`, `POSTGRES_URL` igual, `NEXTAUTH_SECRET=ci`, `NEXTAUTH_URL=http://localhost:3000`, `SKIP_ENV_VALIDATION=1`. Si el build falla por otra variable, agregarla con valor falso, nunca un secreto.
- [ ] **Step 3:** Validar localmente lo mismo: `npx tsc --noEmit && npm run lint && npm test && npm run build` con esas variables → todo OK.
- [ ] **Step 4:** Commit `ci: typecheck, lint, tests y build en cada PR`.

### Task 3: Entorno QA y desvío de correos

**Files:**
- Create: `src/lib/appEnv.ts`, `src/lib/qaEmail.ts`, `src/lib/qaEmail.test.ts`
- Modify: `src/lib/emailService.ts:91-138` (`sendEmail`)

**Interfaces:**
- Produces: `isQa(): boolean` (`process.env.APP_ENV === 'qa'`) en `src/lib/appEnv.ts`.
- Produces: `routeQaEmail(input: { to: string[]; subject: string; sink: string | undefined; allowlist: string | undefined }): { to: string[]; subject: string } | null` en `src/lib/qaEmail.ts`. `null` = no enviar.

- [ ] **Step 1: Tests** en `qaEmail.test.ts`:
  - `todos permitidos` → `routeQaEmail({ to: ['jose@x.com'], subject: 'Hola', sink: 'sink@x.com', allowlist: 'jose@x.com, adriana@x.com' })` → `{ to: ['jose@x.com'], subject: '[QA → jose@x.com] Hola' }`.
  - `no permitido va al sink` → `to: ['clienta@gmail.com']` → `{ to: ['sink@x.com'], subject: '[QA → clienta@gmail.com] Hola' }`.
  - `mezcla` → `to: ['adriana@x.com', 'clienta@gmail.com']` → `to: ['adriana@x.com', 'sink@x.com']` (sin duplicar el sink si hay varios no permitidos), asunto con ambos originales separados por `, `.
  - `normaliza mayúsculas y espacios` → `to: [' Adriana@X.com ']` con allowlist `adriana@x.com` → `to: ['adriana@x.com']`.
  - `sin sink y sin permitidos` → `sink: undefined`, `to: ['clienta@gmail.com']` → `null`.
  - `sin sink con mezcla` → solo los permitidos.
- [ ] **Step 2:** `npx vitest run src/lib/qaEmail.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `appEnv.ts` y `qaEmail.ts`.
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** En `sendEmail`, antes de pedir el token: si `isQa()`, aplicar `routeQaEmail` con `process.env.QA_EMAIL_SINK` / `QA_EMAIL_ALLOWLIST`; si da `null`, loguear `[EMAIL][QA] descartado: <destinatarios>` y devolver `{ success: true }` sin llamar a Graph; si no, usar `to`/`subject` resultantes. Fuera de QA, cero cambios.
- [ ] **Step 6:** Test en `qaEmail.test.ts` o nuevo `emailService.test.ts` con `fetch` mockeado: con `APP_ENV` sin definir, el body enviado a Graph tiene los destinatarios y asunto originales; con `APP_ENV=qa` y sink, tiene el sink y el prefijo.
- [ ] **Step 7:** `npm test` → PASS. Commit `feat(qa): desvío de correos en QA (sink + lista permitida)`.

### Task 4: Bloqueo de QA, noindex y franja

**Files:**
- Create: `src/lib/qaGate.ts`, `src/lib/qaGate.test.ts`, `src/components/QaBanner.tsx`, `src/app/robots.ts`
- Modify: `src/middleware.ts` (todo), `src/app/layout.tsx:18-51`

**Interfaces:**
- Consumes: `isQa()` (Task 3).
- Produces: `qaGateDecision(input: { pathname: string; authorization: string | null; password: string | undefined; qa: boolean }): 'allow' | 'challenge'` en `src/lib/qaGate.ts`. Basic Auth: se acepta cualquier usuario si la contraseña coincide. Si `qa` es true y `password` está vacío → `'challenge'` siempre (fallar cerrado).

- [ ] **Step 1: Tests** en `qaGate.test.ts`:
  - `fuera de QA siempre deja pasar` → `qa: false`, sin header → `'allow'`.
  - `QA sin credenciales pide contraseña` → `'challenge'`.
  - `QA con contraseña correcta` → header `'Basic ' + btoa('adriana:secreta')`, `password: 'secreta'` → `'allow'`.
  - `QA con contraseña incorrecta` → `'challenge'`.
  - `QA sin QA_ACCESS_PASSWORD configurada` → `'challenge'` aunque mande header.
  - `rutas exentas` → `/api/payments/payway/callback`, `/api/payments/payway/denied`, `/api/webhooks/facturador`, `/api/cron/sales-report`, `/_next/static/x.js` → `'allow'` sin header.
  - `prefijos parecidos no quedan exentos` → `/api/cron-falso` → `'challenge'`.
- [ ] **Step 2:** Tests → FAIL. **Step 3:** Implementar `qaGate.ts` (sin dependencias de Node: corre en Edge). **Step 4:** Tests → PASS.
- [ ] **Step 5:** Reescribir `src/middleware.ts`: `export default async function middleware(req: NextRequest, event: NextFetchEvent)`. Primero `qaGateDecision` (con `isQa()`, `req.headers.get('authorization')`, `process.env.QA_ACCESS_PASSWORD`); si `'challenge'` → `401` con header `WWW-Authenticate: Basic realm="Wellnest QA"`. Después, solo si el path empieza con `/perfil`, `/reservar`, `/carrito`, `/checkout` o `/admin`, delegar al handler de `withAuth` actual (mismas reglas, mismo callback `authorized` con `token?.id`, misma redirección de admin). `config.matcher`: todo salvo `_next/static`, `_next/image`, `favicon.ico`.
- [ ] **Step 6:** Test de humo del middleware (con `next-auth/middleware` mockeado) para Review Focus 1: sin `APP_ENV`, `GET /` → no es 401; `GET /perfil` → llega al handler de `withAuth`.
- [ ] **Step 7:** `src/app/robots.ts`: en QA `disallow: '/'` para todos; fuera de QA, el comportamiento actual (si hoy no hay robots, `allow: '/'` + `sitemap` si existe). En `layout.tsx`, `metadata.robots = { index: false, follow: false }` cuando `isQa()`, y `<QaBanner />` como primer hijo de `<body>` solo en QA.
- [ ] **Step 8:** `QaBanner`: franja fija arriba, texto exacto `QA — no es el sitio real`, color de advertencia que no se confunda con la marca, que no tape la navegación (empuja el contenido).
- [ ] **Step 9:** `npm test && npx tsc --noEmit && npm run build` → OK. Verificación manual: `APP_ENV=qa QA_ACCESS_PASSWORD=x npm run dev` → el navegador pide contraseña; con `x` entra y se ve la franja; `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/cron/sales-report` ≠ 401. Sin `APP_ENV` → todo como hoy.
- [ ] **Step 10:** Commit `feat(qa): bloqueo con contraseña, noindex y franja de QA`.

### Task 5: Vercel solo despliega `main` y `develop`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1:** Agregar `"ignoreCommand": "bash -c '[[ \"$VERCEL_GIT_COMMIT_REF\" != \"main\" && \"$VERCEL_GIT_COMMIT_REF\" != \"develop\" ]]'"` (exit 0 = Vercel omite el build). Conservar `crons`.
- [ ] **Step 2:** Verificar el comando en local: `VERCEL_GIT_COMMIT_REF=main bash -c '…'; echo $?` → `1`; con `develop` → `1`; con `feat/x` → `0`.
- [ ] **Step 3:** Commit `chore(vercel): solo main y develop generan deploy`.

### Task 6: Lo local apunta a QA; producción solo con señal

**Files:**
- Create: `src/lib/envFiles.ts`, `src/lib/envFiles.test.ts`
- Modify: `scripts/loadEnv.ts`
- Modify: encabezados de uso de `scripts/send-followup-list-email.ts`, `scripts/send-event-thanks.ts`, `scripts/audit-discrepancia-*.ts` trackeados, y cualquier script trackeado cuyo comentario diga que lee producción

**Interfaces:**
- Produces: `resolveEnvFiles(input: { argv: string[]; wellnestEnv: string | undefined }): { files: string[]; production: boolean }` en `src/lib/envFiles.ts`. Producción si `argv` incluye `--prod` o `wellnestEnv === 'prod'`. Producción → `['.env.prod']` únicamente. Si no → `['.env', '.env.local']`.

- [ ] **Step 1: Tests** en `envFiles.test.ts`:
  - `por defecto QA` → `{ argv: [], wellnestEnv: undefined }` → `{ files: ['.env', '.env.local'], production: false }`.
  - `--prod` → `{ files: ['.env.prod'], production: true }`.
  - `WELLNEST_ENV=prod` → igual.
  - `otro valor no es prod` → `wellnestEnv: 'production'` → `production: false` (solo `prod` exacto).
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS.
- [ ] **Step 5:** `scripts/loadEnv.ts`: usar `resolveEnvFiles({ argv: process.argv, wellnestEnv: process.env.WELLNEST_ENV })`; si `production` y `.env.prod` no existe → error y `process.exit(1)`; si `production`, imprimir a `stderr` un aviso en mayúsculas `PRODUCCIÓN — base <host de POSTGRES_URL>` (solo host, nunca la URL completa). Mantener la regla "variable ya presente gana".
- [ ] **Step 6:** Actualizar los encabezados de uso de los scripts listados: `WELLNEST_ENV=prod npx tsx scripts/…` (o `--prod`).
- [ ] **Step 7:** Verificación: con `.env` apuntando a QA (después de Task 9), `npx tsx scripts/audit-db-counts.ts` muestra host de QA; con `--prod`, muestra el aviso y el host de prod. Antes de Task 9, verificar con un `.env.prod` de prueba falso en un worktree.
- [ ] **Step 8:** Commit `feat(scripts): lo local usa QA; producción con --prod o WELLNEST_ENV=prod`.

### Task 7: Refresco de la base de QA (copia anonimizada)

**Files:**
- Create: `prisma/sql/qa/anonimizar.sql`, `prisma/sql/qa/verificar.sql`, `scripts/qa-refresh.sh`

- [ ] **Step 1:** `anonimizar.sql` (una transacción, `\set ON_ERROR_STOP on`). Sobre la copia en QA:
  - `User` con `role <> 'ADMIN'`: `name = 'Usuaria ' || n`, `email = 'usuaria' || n || '@qa.wellneststudio.net'` (n = `row_number()` por `createdAt`), `phone`, `documentId`, `documentType`, `fiscalAddress`, `birthDate`, `profileImage` → `NULL`.
  - `User` (todas, ADMIN incluidas): `password` = hash bcrypt pasado como variable psql `:'qa_password_hash'` (José lo genera; no va en el repo).
  - `Account`: tokens (`access_token`, `refresh_token`, `id_token`) → `NULL`. `Session`, `VerificationToken`, `PasswordResetToken`: vaciar (DELETE: son tablas de QA).
  - `Reservation.guestEmail/guestName`, `Referral.referredEmail`, `ContactMessage` (name/email/phone/message), `PaymentTransaction.cardHolder/rawPayload`, `webhook_logs.payload` → ficticios o `NULL`/`'{}'`.
  - `EventOrder` buyerName/buyerEmail/buyerPhone y `EventTicket` holderName/holderEmail/holderPhone → ficticios; `accessToken` y `token` → regenerados (`md5(random()::text || id)` dos veces concatenado, 64 hex).
  - Revisar `prisma/schema.prisma` completo al implementar: cualquier otra columna con nombre, correo, teléfono, documento o dirección entra aquí.
- [ ] **Step 2:** `verificar.sql`: devuelve una fila por chequeo con conteo que debe ser 0: usuarias no ADMIN con correo que no termina en `@qa.wellneststudio.net`; filas con `phone`/`documentId` no nulos en no ADMIN; `EventOrder` con correo que no termina en `@qa.wellneststudio.net`; sesiones existentes.
- [ ] **Step 3:** `qa-refresh.sh`: lee `PROD_URL` de `.env.prod` (`POSTGRES_URL`) y `QA_URL` de `.env` (`POSTGRES_URL`); **aborta si el host de `QA_URL` es igual al de `PROD_URL`, si `QA_URL` está vacío, o si contiene `prod`** (Review Focus 4). Imprime ambos hosts y pide escribir `qa` para seguir. Pasos: `pg_dump --no-owner --no-privileges -Fc` de prod a un archivo temporal → `pg_restore --clean --if-exists --no-owner -d $QA_URL` → `psql -v qa_password_hash=… -f anonimizar.sql` → `psql -f verificar.sql` y falla si algún conteo ≠ 0 → borra el dump temporal. Pide el hash con `read -s`.
- [ ] **Step 4:** Verificación sin bases: `bash -n scripts/qa-refresh.sh`; correrlo con `QA_URL` = `PROD_URL` falsos iguales → aborta con mensaje. La corrida real es Task 9 (José).
- [ ] **Step 5:** Commit `feat(qa): script de refresco de la base de QA con anonimización`.

### Task 8: Reglas escritas

**Files:**
- Create: `CLAUDE.md`, `docs/flujo-ramas-deploy.md`, `.github/pull_request_template.md`

- [ ] **Step 1:** `CLAUDE.md` (corto): ramas (`feat|fix|docs|chore/*` desde `develop`; `hotfix/*` desde `main` + back-merge el mismo día); nunca push a `main`/`develop`; Claude no mergea PRs de promoción; nunca `db push`; SQL manual primero en QA; base de producción solo la toca José; lo local es QA y producción se pide con `--prod`/`WELLNEST_ENV=prod`; importar `./loadEnv` primero en scripts; `scripts/` fuera de tsconfig.
- [ ] **Step 2:** `docs/flujo-ramas-deploy.md`: runbook con secciones Feature, Promoción a producción (incluye `git log origin/main..origin/develop --oneline`, qué se probó y quién, SQL pendiente), Hotfix, Si QA falla (se arregla en `develop`, nunca en `main`), Refrescar QA (`scripts/qa-refresh.sh`), Invariante (`git rev-list --no-merges --count origin/develop..origin/main` = 0), Variables por entorno (tabla de la spec).
- [ ] **Step 3:** Plantilla de PR: Qué cambia · Cómo se probó · ¿SQL manual? (dónde y si ya corrió en QA) · `- [ ] Probado en qa.wellneststudio.net` · `- [ ] (promoción) aprobado por José`.
- [ ] **Step 4:** Commit `docs: reglas del flujo QA → producción`.

### Task 9: Puesta en marcha (José + Claude, en este orden)

Sin código. Cada paso con José; Claude prepara comandos y verifica. Ningún paso se encadena con otro.

- [ ] **Step 1:** PR de Tasks 1–8 a `main` (excepción de arranque: `develop` aún no existe). CI debe correr en el PR y pasar. José mergea.
- [ ] **Step 2:** Crear `develop` desde `main`: `git push origin origin/main:refs/heads/develop`.
- [ ] **Step 3 (José, Vercel):** revisar variables scope Preview genéricas y borrar las que apunten a producción (DB, PayWay prod, Facturo prod, Azure). Borrar en Deployments (o dejar tras Deployment Protection) todos los preview deployments existentes que no sean de `main` ni `develop`: el `ignoreCommand` solo frena previews nuevas y las viejas conservan las variables con las que se construyeron (posiblemente de prod). Crear base Prisma Postgres de QA.
- [ ] **Step 4 (José, Vercel):** variables Preview → rama `develop`: `DATABASE_URL`, `POSTGRES_URL`, `DATABASE_POOLED_URL` (QA), `APP_ENV=qa`, `QA_ACCESS_PASSWORD`, `QA_EMAIL_SINK`, `QA_EMAIL_ALLOWLIST`, `NEXTAUTH_URL=https://qa.wellneststudio.net`, `NEXTAUTH_SECRET`/`CRON_SECRET`/`BOOTSTRAP_SECRET`/`PAYWAY_CALLBACK_SECRET`/`FACTURADOR_SV_WEBHOOK_SECRET` nuevos, `PAYWAY_ENV=TEST` + credenciales de prueba, `PAYWAY_CALLBACK_PUBLIC_BASE_URL=https://qa.wellneststudio.net`, `FACTURADOR_SV_*` de Facturo QA o vacías, `AZURE_*`/`EMAIL_FROM` (pueden ser los mismos: el desvío protege). Todo con `printf`.
- [ ] **Step 5 (José):** dominio `qa.wellneststudio.net` → proyecto, asignado a la rama `develop` (Vercel → Domains → Git branch). DNS si hace falta.
- [ ] **Step 6 (José, local):** mover el `.env` y `.env.local` actuales a `.env.prod` (unidos) con `APP_ENV=production` explícito; crear `.env`/`.env.local` con valores de QA, con `APP_ENV=qa` en `.env` (sin ella, `loadEnv` aborta todo script en modo por defecto). Migrar los scripts mensuales no trackeados de José (auditorías, lista de seguimiento, reportes) a `import './loadEnv'` de primero. En el checkout principal, `npx prisma generate` (sin base) para regenerar el cliente con el `.env` nuevo. Claude verifica con `npx tsx scripts/audit-db-counts.ts` ya migrado a `./loadEnv` (debe mostrar host QA) y `WELLNEST_ENV=prod` (aviso + host prod).
- [ ] **Step 7 (José):** `bash scripts/qa-refresh.sh`. Claude revisa la salida de `verificar.sql` (todo 0).
- [ ] **Step 8:** Push vacío o redeploy de `develop`; Claude verifica: `curl -I https://qa.wellneststudio.net` → 401 con `WWW-Authenticate`; con contraseña → 200 y la franja en el HTML; `robots.txt` → `Disallow: /`. José y Adriana entran con su correo y la contraseña de QA; Adriana reserva una clase y recibe el correo con prefijo `[QA → …]`.
- [ ] **Step 9 (Claude, con OK de José):** protección de ramas vía `gh api`: `main` y `develop` → PR obligatorio, checks requeridos `checks` (job de Task 2), sin force-push ni borrado, 0 reseñas requeridas; activar `delete_branch_on_merge`. Verificar con `gh api repos/jbidegain99-ux/the-wellnest-landing/branches/main/protection`.
- [ ] **Step 10:** Actualizar memorias de Claude: `wellnest-production-env` (local ya no es prod) y `project-qa-flow-plan` (implementado).
