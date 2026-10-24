# Flujo QA → producción para Wellnest — diseño

Fecha: 23-oct-2026 · Autor de la decisión: José Bidegain · Estado: borrador para aprobar

## Por qué

Hoy todo lo que se fusiona a `main` va directo a producción (Vercel, wellneststudio.net), y las pruebas
se hacen en el sitio real con la base real. El 22-oct eso obligó a borrar a mano pedidos de prueba de
The Villains Ball en producción, dos veces, mientras entraban compras reales. José quiere el mismo
camino que ya usa en Facturo y TalentOS: probar en un entorno QA y solo después pasar a producción.

Éxito = ningún cambio llega a las clientas sin haber estado antes en QA y sin el visto bueno de José,
y ninguna prueba vuelve a tocar datos, correos, pagos o facturas reales.

## Lo que se copió de Facturo y TalentOS (y lo que no)

Se copia: modelo de ramas en una sola dirección con PR en cada paso, QA con base y secretos propios,
correo de QA desviado, migraciones primero en QA, back-merge de hotfixes, invariante
`main ⊆ develop`. Referencias: `Facturo/docs/flujo-ramas-deploy.md`, `Facturo/tasks/lessons.md:193-215`,
`TalentOS/docs/runbooks/migrations.md`.

No se copia: Docker/Dokploy/Traefik, compose por entorno, el nivel extra `develop`→`master` de Facturo
(Wellnest es un equipo de una persona; un nivel menos), cherry-pick a ramas `release/*`.

Se agrega lo que a los dos les falta: CI que corre en cada PR y protección de ramas en GitHub
(el repo `jbidegain99-ux/the-wellnest-landing` es público, así que la protección es gratis).

## Metas

1. Ramas: `feat/*` · `fix/*` · `docs/*` · `chore/*` salen de `develop` y vuelven a `develop` por PR.
   `develop` = QA. `main` = producción. A `main` solo entra `develop` por un PR de promoción
   ("release: …") con merge commit, sin squash, que aprueba José.
2. Hotfix urgente: `hotfix/*` sale de `main`, PR a `main`, y en el mismo día se fusiona `main` → `develop`.
   Nunca se deja `main` con commits que `develop` no tenga. Chequeo, sin contar los merge commits de
   promoción: `git rev-list --no-merges --count origin/develop..origin/main` debe dar 0.
3. Entorno QA en `https://qa.wellneststudio.net`, desplegado automáticamente por Vercel en cada push a `develop`.
4. Base de datos QA separada: copia de producción con datos de clientas anonimizados.
5. En QA nada sale hacia afuera de verdad: correos, pagos, facturas y crons quedan contenidos (detalle abajo).
6. CI en GitHub Actions en cada PR a `develop` y `main`: typecheck, lint, tests, build.
7. Protección de ramas `main` y `develop`: sin push directo, PR obligatorio, CI en verde obligatorio.
8. Desarrollo local apunta a QA por defecto (detalle en "Entorno local"). Producción solo se usa
   eligiéndola a propósito.
9. Reglas escritas en el repo: `CLAUDE.md` del proyecto, `docs/flujo-ramas-deploy.md`, plantilla de PR.

## No-metas

- Entornos por feature con base propia (cada preview con su base). Solo hay un QA.
- Migrar a `prisma migrate` (está en un plan aparte: ver "Plan Float→Decimal + migrate"). Este flujo
  sigue con SQL manual en `prisma/sql/`, solo que primero en QA.
- Pruebas end-to-end automatizadas en CI (Playwright). Se pueden sumar después.
- Restricción de horario para publicar a producción (Facturo publica de noche; acá no se pidió).

## Anti-metas (si pasa esto, falló aunque "funcione")

- Una clienta real recibe un correo, WhatsApp o factura originado en QA.
- QA o un preview de rama escribe en la base de producción.
- PayWay cobra de verdad desde QA, o una factura de QA llega al ambiente de producción de Hacienda.
- QA aparece en Google o se puede usar sin la contraseña de QA.
- Se corre `prisma db push` contra cualquier base (borra el índice único parcial anti-duplicados
  hecho a mano en producción).

## Restricciones

- Vercel plan Hobby: no hay Custom Environments ni miembros de equipo. QA = Preview fijado a la rama
  `develop` con dominio propio. Variables de QA = scope Preview filtrado a la rama `develop`.
- Hoy cada rama que se sube publica una preview abierta en `*.vercel.app` (sin protección de Vercel) con
  las variables Preview genéricas, que no se pudieron leer (la API negó acceso) y podrían apuntar a la
  base de producción. **Decisión (Claude):** solo se despliegan `main` (producción) y `develop` (QA);
  las demás ramas no generan preview (ignore step en `vercel.json` o `git.deploymentEnabled`). Primer
  paso de la implementación: José revisa en Vercel las variables Preview genéricas y borra las que
  apunten a producción.
- `NODE_ENV` es `production` también en previews. Para distinguir QA usar `VERCEL_ENV === 'preview'`
  y una variable explícita `APP_ENV=qa` (decisión del builder cuál de las dos lee el código; recomendado
  `APP_ENV`, porque no depende de Vercel).
- Base: Prisma Postgres (`db.prisma.io`). `DATABASE_URL` es Accelerate y rechaza DDL; para restaurar y
  para SQL manual se usa la conexión directa (`POSTGRES_URL`).
- Reglas globales de José sobre bases (`~/.claude/CLAUDE.md`): Claude nunca corre comandos destructivos
  ni contra producción. `pg_dump` de producción es lectura; restaurar en QA, anonimizar y cualquier SQL
  en producción lo corre José. Claude prepara scripts y verifica.
- `scripts/` no está en `tsconfig`: tsc no valida los scripts.

## Cómo funciona

### Ramas y promoción

```
feat/x ──PR──▶ develop ──(deploy QA)──▶ PR "release" ──José aprueba──▶ main ──(deploy prod)
hotfix/y ──PR──▶ main ──▶ merge main → develop (mismo día)
```

Antes de abrir un PR de promoción: `git log origin/main..origin/develop --oneline` en la descripción,
lista de qué se probó en QA y quién (José / Adriana), y SQL manual pendiente para producción si lo hay.

### Base de datos de QA

- José crea una base Prisma Postgres nueva para QA (Vercel Marketplace o consola de Prisma) y deja sus
  URLs (Accelerate + directa) en Vercel, scope Preview → rama `develop`, y en un `.env.qa` local.
  `.gitignore` hoy NO cubre `.env.qa` (y el repo es público): agregar `.env*` con excepción de
  `.env.example` antes de crear el archivo.
- Copia: `pg_dump` de producción (solo lectura, `--no-owner --no-privileges`) → `pg_restore` en QA.
  Incluye el índice parcial hecho a mano.
- Anonimización, en un script SQL que se corre sobre QA inmediatamente después de restaurar
  (`prisma/sql/qa/anonimizar.sql` o similar):
  - Usuarias con rol distinto de ADMIN: nombre → "Usuaria N", correo → `usuaria<N>@qa.wellneststudio.net`,
    teléfono → número ficticio, otros datos personales (dirección, fecha de nacimiento, si existen) → nulos o ficticios.
  - Cuentas ADMIN (incluida Adriana) conservan su correo real, para entrar con su correo de siempre.
  - Todas las contraseñas → una misma contraseña de QA (hash bcrypt), guardada en el gestor de José,
    no en el repo.
  - Datos personales en otras tablas: compradores e invitados de eventos (`EventOrder`, `EventTicket`),
    invitadas sin cuenta, solicitudes de clases privadas, datos de facturación del receptor, tokens de
    reseteo de contraseña y sesiones. El builder recorre `prisma/schema.prisma` completo y anonimiza toda
    columna con nombre, correo, teléfono, documento o dirección.
  - Tokens/secretos guardados en filas (tokens de PayWay, `accessToken` de pedidos) → regenerados o nulos.
- Se conserva: paquetes, compras (montos), reservas, asistencias, clases, horarios, instructoras, eventos.
- El script de refresco (`scripts/qa-refresh.sh` o similar) hace dump → restore → anonimizar → verificación
  (cuenta usuarias con correo que no termine en `@qa.wellneststudio.net` y no sean ADMIN: debe dar 0).
  Lo corre José; muestra a qué host apunta cada paso antes de ejecutar y pide confirmación.

### Qué queda contenido en QA

| Salida | En QA |
|---|---|
| Correo (Microsoft Graph, `src/lib/emailService.ts` → `sendEmail`) | Si el destinatario está en `QA_EMAIL_ALLOWLIST` (José y Adriana), le llega a esa persona; cualquier otro destinatario se reemplaza por `QA_EMAIL_SINK` (casilla de prueba de José). Siempre con asunto `[QA → destinatario-original]`. Si `APP_ENV=qa` y falta `QA_EMAIL_SINK`, los no permitidos no se envían. |
| Destinatarios de reportes (`ADMIN_NOTIFICATION_EMAIL`, `INSTRUCTOR_PAYMENTS_RECIPIENT`, `SALES_REPORT_RECIPIENT`, `PAYMENT_ALERT_RECIPIENTS`) | Igual pasan por `sendEmail`, así que quedan desviados. |
| PayWay | `PAYWAY_ENV=TEST` con credenciales de prueba; `PAYWAY_CALLBACK_PUBLIC_BASE_URL` = dominio de QA. |
| Facturación electrónica (`src/lib/facturador/client.ts`) | `FACTURADOR_SV_API_URL` → QA de Facturo (`api-qa.facturoelectronicosv.com`, ambiente de pruebas de Hacienda) con un tenant de pruebas. Sin tenant de QA: variables vacías → facturación deshabilitada (el cliente ya lo soporta). Nunca la URL de producción. |
| Crons (`vercel.json`) | Vercel solo los corre en producción: QA no los ejecuta. Se prueban a mano llamando al endpoint con `CRON_SECRET` de QA. |
| WhatsApp | Son enlaces que abre quien hace clic; los números de QA son ficticios. Sin cambio. |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Propios de QA (cargar con `printf`, sin salto de línea: ver incidente del 22-oct). |
| Secretos (`CRON_SECRET`, `BOOTSTRAP_SECRET`, `PAYWAY_CALLBACK_SECRET`, `FACTURADOR_SV_WEBHOOK_SECRET`) | Distintos de producción. |

### Acceso a QA

- Vercel Deployment Protection no sirve para Adriana (Hobby no permite miembros). En su lugar: el
  middleware pide una contraseña de QA (Basic Auth o pantalla propia con cookie, decisión del builder)
  cuando `APP_ENV=qa`; la contraseña vive en la variable `QA_ACCESS_PASSWORD`. Excepciones: el callback
  de PayWay y los webhooks de Facturo, que no pueden autenticarse así.
- `robots` y metadatos `noindex` en QA.
- Franja fija arriba en todas las páginas: "QA — no es el sitio real".
- Hoy `src/middleware.ts` solo corre en rutas protegidas (`matcher`); el bloqueo de QA necesita correr
  en todas las rutas sin cambiar el comportamiento en producción.

### Entorno local

Hoy `.env` y `.env.local` apuntan a producción: `npm run dev`, los scripts con `tsx` y la CLI de Prisma
leen y escriben la base real, y los correos salen de verdad. Decisión de José: lo local usa QA por defecto.

- `.env` / `.env.local` pasan a tener los valores de QA (base QA, `APP_ENV=qa`, `QA_EMAIL_SINK`,
  PayWay TEST). Así `next dev`, Prisma CLI y `scripts/loadEnv.ts` caen en QA sin hacer nada.
- Las credenciales de producción se mudan a un archivo aparte (`.env.prod`, gitignored) que nadie
  carga por accidente: ni Next ni Prisma lo leen solos.
- `scripts/loadEnv.ts` carga `.env.prod` solo si se pide explícitamente (p. ej. `WELLNEST_ENV=prod`
  o `--prod`; forma exacta al builder) y, cuando lo hace, imprime en grande el host de la base y
  "PRODUCCIÓN" antes de seguir. Sin la señal, nunca toca producción aunque `.env.prod` exista.
- Scripts que hoy leen producción a propósito (auditorías mensuales `audit-discrepancia-*`, lista de
  seguimiento `send-followup-list-email.ts`, reportes de ventas/asistencias, `send-event-thanks.ts`):
  siguen funcionando, pero se corren con la señal de producción. El builder actualiza los que tengan
  instrucciones de uso en su encabezado.
- Comandos `psql` documentados que hoy toman `POSTGRES_URL` de `.env` pasan a tomarlo de `.env.prod`
  cuando son para producción.
- `CLAUDE.md` del repo y las memorias de Claude que dicen "el `.env` local = producción" se actualizan
  al terminar.

### CI (GitHub Actions)

En cada PR a `develop` y `main`, y en push a ambas: `npm ci`, `npx tsc --noEmit`, `npm run lint`,
`npm test`, `npm run build` (con variables mínimas falsas; el build no debe necesitar la base).
Antes de exigirlo en verde hay que dejar `main` pasando: hoy fallan 4 tests ajenos
(`instructorPaymentsGuests`, `classDates`) y `tsc` marca `guestAttendance` en
`src/app/api/admin/attendance/add-attendee/route.ts`. El builder los arregla o los marca, con OK de José,
en un PR propio antes de activar la protección.
`npm run lint` hoy abre el asistente interactivo de Next: hay que agregar una config de ESLint para que corra en CI.

### Protección de ramas (GitHub)

- `main`: PR obligatorio, CI en verde, sin force-push ni borrado. Sin exigir reseñas aprobadas de otra
  persona (José es el único dev; GitHub no deja que el autor apruebe su propio PR). El "visto bueno" de
  José es él mismo mergeando el PR de promoción.
- `develop`: PR obligatorio, CI en verde, sin force-push.
- Activar "borrar rama al mergear".
- Crear `develop` desde `main` actual antes de proteger.

### Reglas escritas

- `CLAUDE.md` en la raíz del repo (hoy no existe; el de `/home/jose/CLAUDE.md` es de otro proyecto):
  flujo de ramas, "nunca push a `main`/`develop`", "Claude no mergea PRs de promoción", "nunca `db push`",
  SQL manual primero en QA, base de producción la toca solo José, carga de env en scripts (`./loadEnv`).
- `docs/flujo-ramas-deploy.md`: el paso a paso de este documento en formato runbook (feature, promoción,
  hotfix, refresco de QA, qué hacer si QA falla: se arregla en `develop`, nunca en `main`).
- `.github/pull_request_template.md`: qué cambia, cómo se probó, ¿SQL manual?, checklist "probado en QA".

### SQL manual (cambios de esquema)

Cada `prisma/sql/*.sql` se corre primero en QA (José, con la `POSTGRES_URL` de QA), se prueba en
`qa.wellneststudio.net`, y se corre en producción justo antes de mergear el PR de promoción que lo necesita.
El PR de promoción lista el SQL pendiente.

## Decidido por José

- Copiar el modelo de Facturo/TalentOS: QA primero, producción después.
- Base QA = copia de producción, anonimizada.
- Lo local (dev y scripts) apunta a QA por defecto; producción solo eligiéndola a propósito.
- Prueban en QA: José y Adriana (equipo Wellnest).
- José da el visto bueno final para pasar a producción.

## Decisiones mías (de Claude) que José puede cambiar

- Un nivel de ramas menos que Facturo (`develop` es QA directamente).
- Dominio `qa.wellneststudio.net`.
- Contraseña única de QA en vez de cuentas de Vercel.
- Cuentas ADMIN conservan su correo real en QA.
- Correos de QA a una casilla de prueba con prefijo en el asunto; José y Adriana sí reciben los suyos (lista permitida), para que Adriana vea los correos que generan sus pruebas.
- Solo `main` y `develop` se despliegan en Vercel; las demás ramas no generan preview.
- El chequeo `main ⊆ develop` ignora los merge commits de promoción.
- Facturación de QA contra el QA de Facturo, o deshabilitada si no hay tenant de pruebas.
- Sin reseña obligatoria en GitHub (no hay segunda persona que apruebe).

## Queda al builder

Nombres de scripts y archivos, forma exacta del bloqueo por contraseña, cómo se pasa la franja de QA al
layout, estructura del workflow de CI, y el orden de los pasos, siempre que la protección de ramas se
active después de que CI pase en `main`.
