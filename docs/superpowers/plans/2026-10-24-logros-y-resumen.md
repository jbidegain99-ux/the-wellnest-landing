# Logros, visibilidad y correo de resumen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insignias estilo Apple con página propia, progreso visible en todo el sitio y correo de resumen después de cada clase.

**Architecture:** Los logros se calculan en lógica pura a partir de las asistencias (sin tablas); el arte es una función pura que devuelve SVG, usada en la web y para generar PNG del correo. Un endpoint "glance" alimenta Navbar, franja de la home y celebración. Un cron dos veces al día manda el resumen, con dos tablas nuevas (registro de envíos y bajas).

**Tech Stack:** Next.js 14 App Router, next-auth 4, Prisma 5 (Postgres), Tailwind, Vitest (node), date-fns-tz, sharp, Microsoft Graph (`sendEmail`).

**Spec:** `docs/superpowers/specs/2026-10-24-logros-y-resumen-design.md` (y `2026-10-24-mi-progreso-design.md` como base).

## Global Constraints
- Nunca `any`; tipos explícitos.
- Nunca `prisma db push`. Cambios de esquema solo por `prisma/sql/*.sql` + `schema.prisma`; el implementador NO ejecuta SQL contra ninguna base (lo hace el controlador con permiso de José).
- Todo cálculo de fecha en `America/El_Salvador`; semanas lunes–domingo.
- `WEEKLY_TARGET_MINUTES = 150`.
- No usar modificadores de opacidad en colores de marca (`bg-primary/10` no genera CSS); usar `primary-50`/`primary-100`/`beige`/hex.
- Sin librerías nuevas. `lucide-react` solo para íconos de interfaz.
- Copy en español, tono cálido, sin culpa (nunca retos fallados ni rachas perdidas), sin calorías en logros ni correo.
- Móvil primero. `prefers-reduced-motion` respetado en animaciones.
- Tests: `npx vitest run <ruta>`; suite: `npm test`; tipos: `npx tsc --noEmit` (errores preexistentes de `guestAttendance` del WIP de José no cuentan); lint: `npm run lint`.
- Commits en español con prefijo convencional (`feat(logros): …`).

## Review Focus
1. Usuaria sin ninguna clase asistida: logros, glance, franja, Navbar y celebración no rompen y muestran invitación.
2. Clases con `durationMin` 0 o disciplina desconocida/nueva: no cuentan para "Disciplinas" pero sí para "Clases" y no lanzan error.
3. Bordes de fecha SV: clase el domingo 23:30 SV o el 1 de mes a las 00:30 SV cae en la semana/mes local correctos (no UTC).
4. Cron corriendo dos veces sobre la misma ventana o envío fallido: nunca duplica correo y reintenta lo fallido.
5. Enlace de baja con `t` alterado o `u` inexistente: 400 sin revelar nada; con firma válida es idempotente.

---

### Task 1: Helpers de tiempo compartidos

**Files:**
- Create: `src/lib/progress/time.ts`
- Modify: `src/lib/progress/summary.ts` (usar los helpers en vez de los locales)
- Test: `src/lib/progress/time.test.ts`

**Interfaces:**
- Produces:
  - `export const TZ = 'America/El_Salvador'`
  - `export interface LocalParts { year: number; month: number /*0-11*/; day: number /*días desde epoch local*/; hour: number; isoWeekday: number /*1=lun..7=dom*/ }`
  - `export function localParts(d: Date): LocalParts`
  - `export function weekIndex(day: number): number` (lunes–domingo, misma fórmula actual)
  - `export function monthIndex(p: { year: number; month: number }): number` (`year*12+month`)
  - `export const MONTH_LABELS` y `export const MONTH_NAMES = ['enero', …, 'diciembre']`

- [ ] **Step 1:** Tests: `localParts(new Date('2026-10-26T05:30:00Z'))` → domingo 25-oct 23:30 SV (`isoWeekday 7`, `hour 23`), y su `weekIndex` es igual al de `2026-10-19T12:00:00Z` (lunes) y distinto al de `2026-10-26T12:00:00Z`; `localParts(new Date('2026-11-01T05:59:00Z')).month === 9` (aún 31-oct SV).
- [ ] **Step 2:** Correr, ver fallar. **Step 3:** Implementar moviendo la lógica de `summary.ts`. **Step 4:** `npx vitest run src/lib/progress` pasa completo (los tests existentes de summary siguen verdes). **Step 5:** Commit `refactor(progreso): helpers de tiempo compartidos`.

### Task 2: Catálogo y evaluación de logros

**Files:**
- Create: `src/lib/progress/badges/types.ts`, `src/lib/progress/badges/catalog.ts`, `src/lib/progress/badges/evaluate.ts`
- Test: `src/lib/progress/badges/evaluate.test.ts`

**Interfaces:**
- Consumes: `AttendedClass` (summary.ts), `getDisciplineProfile`, `isActiveMet` (profiles.ts), Task 1 helpers.
- Produces (`types.ts`):
  - `export type BadgeCategory = 'clases' | 'disciplinas' | 'constancia' | 'semanas' | 'reto' | 'exploradora' | 'calma' | 'momentos'`
  - `export type BadgeTier = 1 | 2 | 3 | 4 | 5`
  - `export interface BadgeState { id: string; category: BadgeCategory; title: string; description: string; tier: BadgeTier; target: number; current: number; earnedAt: string | null /*ISO de la clase con que se ganó*/; glyph: string /*clave del glifo de arte*/; discipline?: string /*slug, solo 'disciplinas'*/; label?: string /*texto corto sobre la insignia, ej. "25" o "OCT"*/ }`
  - `export const CATEGORY_ORDER: BadgeCategory[]` y `export const CATEGORY_LABELS: Record<BadgeCategory, string>` (Clases, Disciplinas, Constancia, Semanas activas, Reto del mes, Exploradora, Calma, Momentos).
- Produces (`evaluate.ts`):
  - `export function evaluateBadges(classes: AttendedClass[], now: Date): BadgeState[]` — todo el catálogo según el spec: Clases (umbrales del spec; las ganadas + las próximas 3 después de la mayor ganada), Disciplinas (7 slugs × 1/10/25/50/100), Constancia (mejor racha histórica), Semanas activas, Exploradora, Calma, Momentos, y Reto: un BadgeState por cada mes **ganado** + el del mes en curso (ganado o no). Ids: `clases-25`, `disciplina-pole-10`, `racha-8`, `semanas-5`, `reto-2026-10`, `exploradora-5`, `calma-600`, `momento-manianera`, `momento-atardecer`, `momento-doble`, `momento-finde`, `momento-semana-completa`, `aniversario-1`.
  - `export function monthlyTarget(classes: AttendedClass[], monthIdx: number): number` — `clamp(ceil(avg(clases de los 3 meses anteriores, contando ceros) × 1.1), 4, 20)`; sin ninguna clase antes de `monthIdx` = 4.
  - `export function currentChallenge(badges: BadgeState[], now: Date): BadgeState & { daysLeft: number }`
  - `export function nextBadges(badges: BadgeState[], n: number): BadgeState[]` — no ganadas con `current > 0` primero, por `current/target` desc, desempate por `target` asc; excluye el reto (va aparte).
  - `export function recentBadges(badges: BadgeState[], n: number): BadgeState[]` — ganadas por `earnedAt` desc.
- Reglas fijas: `aro-telas` suma a `aro` y `telas` (Disciplinas y Exploradora); Exploradora 7 = las 7 disciplinas de la tabla. Calma = Σ minutos × peso `calma` del perfil. Mañanera: hora local < 9; Atardecer: hora local ≥ 19; Fin de semana: isoWeekday 6 o 7; Doble: 2 clases con mismo `day`; Semana completa: 3 `day` distintos en un mismo `weekIndex`; Aniversario N: existe clase con fecha ≥ primera clase + N años (y ≤ now). `earnedAt` = fecha de la clase que cruza el umbral. Clases con `dateTime > now` se ignoran.

- [ ] **Step 1:** Tests (con fábrica `cls(dateISO, slug, min=60, classType=null)`):
  - Sin clases: `clases-1` no ganada con `current 0`; existe `reto-<mes actual>` con `target 4`; ninguna ganada.
  - 25 clases de pilates: `clases-25.earnedAt` = fecha de la clase 25; `disciplina-pilates-25` ganada; `disciplina-pole-1` no ganada.
  - `aro-telas` ×1 → `disciplina-aro-1` y `disciplina-telas-1` ganadas, Exploradora `current 2`.
  - Racha: semanas 1-2-3 con clase, 4 vacía, 5-6 con clase → `racha-2` ganada (earnedAt en semana 2), `racha-4` no ganada con `current 3` (mejor racha).
  - `monthlyTarget`: 3 meses previos con 6, 8, 10 clases → `ceil(8×1.1)=9`; con 30/30/30 → 20; sin historial → 4.
  - Reto: mes anterior no logrado no aparece; mes logrado aparece con `earnedAt`.
  - Momentos: clase a las 08:30 SV cuenta para mañanera; a las 09:00 no; clase `2026-10-26T05:30:00Z` cuenta como domingo (finde).
  - Disciplina desconocida `slug 'nueva'`: suma a Clases, no rompe, no crea fila.
  - `nextBadges` ordena por porcentaje y excluye reto.
- [ ] **Step 2:** Ver fallar. **Step 3:** Implementar (catálogo declarativo en `catalog.ts`: arreglos de umbrales y textos; `evaluate.ts` recorre en orden). **Step 4:** Tests pasan. **Step 5:** Commit `feat(logros): catálogo y evaluación de logros`.

### Task 3: Arte de las insignias + PNG

**Files:**
- Create: `src/lib/progress/badges/art.ts`, `src/components/badges/BadgeArt.tsx`, `scripts/render-badge-pngs.ts`, `public/images/badges/*.png` (generados)
- Test: `src/lib/progress/badges/art.test.ts`

**Interfaces:**
- Consumes: `BadgeState`, `BadgeCategory`, `BadgeTier` (Task 2).
- Produces:
  - `export function renderBadgeSvg(badge: Pick<BadgeState, 'id' | 'category' | 'tier' | 'glyph' | 'label' | 'discipline'>, opts: { locked: boolean; progress?: number /*0-1, solo locked*/; size?: number }): string` — SVG completo (`viewBox="0 0 120 120"`), ids internos de degradados prefijados con un hash del `id` + estado para que varias insignias en la misma página no choquen.
  - `export function badgePngPath(badge: Pick<BadgeState, 'id' | 'category'>): string | null` → `/images/badges/<id>.png` para ids con PNG generado; reto → `/images/badges/reto-<mmm>.png`; si no hay, `null`.
  - `BadgeArt` (`'use client'` no requerido): props `{ badge; locked; progress?; size?: number; className?; animate?: boolean }`, renderiza el SVG inline (`dangerouslySetInnerHTML`, contenido generado por nosotros) con `role="img"` y `aria-label` = título + estado.
- Diseño (fijo): forma por categoría — clases: círculo; disciplinas: hexágono; constancia: escudo; semanas: sol (círculo con rayos); reto: octógono con banda del mes; exploradora: rombo/brújula; calma: loto (círculo con pétalos); momentos: gota. Metales por tier 1–5: cobre, arena (`#C4A77D`), salvia (`#9CAF88`/`#6B7F5E`), oro cálido, platino perlado (crema `#FFF8EF`). Cara con degradado del color de categoría o de la disciplina (paleta por slug decidida por el implementador). Brillo diagonal, sombra interna, glifo dibujado a mano por tema (clave `glyph`), `label` grande cuando existe. Bloqueada: beige plano (`#E8E0D4`/`#F5F0E8`), glifo tenue, arco de progreso exterior si `progress` > 0. Usar la skill `frontend-design` para el arte.
- Script: `npx tsx scripts/render-badge-pngs.ts` evalúa el catálogo fijo (todas las ids que no son reto, Clases hasta 2000) + `reto-ene…reto-dic`, rasteriza con `sharp` a 240 px estado ganado y escribe `public/images/badges/`. No necesita base de datos ni `loadEnv`.

- [ ] **Step 1:** Tests: el SVG empieza con `<svg` y tiene `viewBox="0 0 120 120"`; dos insignias distintas no comparten ids de `<linearGradient>`; locked con `progress 0.5` contiene el arco y no el brillo; cada `BadgeCategory` produce una forma distinta (por ejemplo, comparar el primer `<path`/`<polygon` del contorno); `badgePngPath({id:'reto-2026-10',category:'reto'})` = `/images/badges/reto-oct.png`.
- [ ] **Step 2:** Ver fallar. **Step 3:** Implementar art + componente. **Step 4:** Tests pasan; correr el script, revisar visualmente 6–8 PNG (Read de la imagen) y ajustar. **Step 5:** Commit `feat(logros): arte de insignias y PNG para correo` (incluye PNG).

### Task 4: Página Mis logros y tarjeta en Mi progreso

**Files:**
- Create: `src/app/api/user/badges/route.ts`, `src/app/(dashboard)/perfil/logros/page.tsx`, `src/components/badges/BadgeDetail.tsx`, `src/components/badges/BadgeGrid.tsx`
- Modify: `src/app/(dashboard)/perfil/progreso/page.tsx` (reemplazar `MilestonesCard` por `LogrosCard`), `src/app/(dashboard)/layout.tsx` (ítem "Mis Logros", Trophy, tercero), `src/components/layout/Navbar.tsx` ("Mis logros" junto a "Mi progreso" en escritorio y móvil)
- Test: `src/app/api/user/badges/route.test.ts`

**Interfaces:**
- Consumes: `evaluateBadges`, `currentChallenge`, `nextBadges`, `recentBadges`, `CATEGORY_ORDER`, `CATEGORY_LABELS`, `BadgeArt`, `loadAttendedClasses`.
- Produces: `GET /api/user/badges` (sesión; 401 sin ella; `force-dynamic`) → `{ badges: BadgeState[]; challenge: BadgeState & { daysLeft: number }; earnedCount: number }`.
- Página según spec (encabezado con conteo, Reto del mes destacado, Recientes, secciones por categoría, detalle al tocar con animación de giro suave). `LogrosCard` en Mi progreso: reto (mini insignia + progreso), últimos 3 ganados, 2 próximos, botón "Ver todos mis logros" → `/perfil/logros`. Mi progreso puede pedir `/api/user/badges` en paralelo a `/api/user/progress`.

- [ ] **Step 1:** Test de la ruta: 401 sin sesión; con sesión mockeada y `loadAttendedClasses` mockeado devuelve `earnedCount` correcto y un `challenge` (mismo patrón que `src/app/api/user/history/route.test.ts`).
- [ ] **Step 2–4:** Ver fallar, implementar, pasar; `npx tsc --noEmit` y `npm run lint` sin errores nuevos.
- [ ] **Step 5:** Verificación visual en `next dev` (cuenta de QA con datos sembrados: Adriana o jbidegain@republicode.com) a 390 px y 1280 px: `/perfil/logros`, detalle abierto, `/perfil/progreso`. Commit `feat(logros): página Mis logros y tarjeta en Mi progreso`.

### Task 5: Visible al entrar — glance, Navbar, home, celebración

**Files:**
- Create: `src/lib/progress/glance.ts`, `src/app/api/user/progress/glance/route.ts`, `src/components/progress/ProgressGlanceProvider.tsx`, `src/components/progress/HomeProgressStrip.tsx`, `src/components/badges/NewBadgeCelebration.tsx`, `src/lib/progress/seenBadges.ts`
- Modify: `src/components/providers/Providers.tsx` (montar provider + celebración), `src/components/layout/Navbar.tsx` (anillo + punto), `src/app/page.tsx` (franja bajo el Navbar, encima del hero)
- Test: `src/lib/progress/glance.test.ts`, `src/lib/progress/seenBadges.test.ts`

**Interfaces:**
- Produces:
  - `export interface ProgressGlance { week: { activeMinutes: number; targetMinutes: number }; streakWeeks: number; totalClasses: number; nextBadge: { id: string; title: string; current: number; target: number } | null; recentBadges: { id: string; title: string; category: BadgeCategory; tier: BadgeTier; glyph: string; label?: string; discipline?: string; earnedAt: string }[] }`
  - `export function buildGlance(classes: AttendedClass[], now: Date): ProgressGlance` (usa `buildProgressSummary` + `evaluateBadges`; `recentBadges` = ganados en los últimos 30 días; `nextBadge` = `nextBadges(…,1)[0]`, o el reto en curso si no hay otro).
  - `GET /api/user/progress/glance` → `ProgressGlance` (sesión, 401).
  - `useProgressGlance(): { glance: ProgressGlance | null; loading: boolean }` desde el provider (pide una vez cuando `useSession().status === 'authenticated'`).
  - `seenBadges.ts`: `export function unseenBadges(earned: { id: string; earnedAt: string }[], seen: string[] | null, now: Date): string[]` (si `seen` es null, todo lo ganado hace > 7 días se considera visto) y `readSeen()/writeSeen(ids)` con try/catch sobre `localStorage['wellnest:logros:vistos']`.
- Navbar: anillo SVG fino alrededor del botón de usuaria (`activeMinutes/targetMinutes`, tope 1) y punto si `unseen.length > 0`. Franja de la home y celebración según spec. Nada se muestra sin sesión.

- [ ] **Step 1:** Tests: `buildGlance([])` → `totalClasses 0`, `nextBadge` = clases-1 o reto, `recentBadges []`; con datos, `recentBadges` excluye ganados hace 31 días. `unseenBadges` con `seen null` devuelve solo los de ≤ 7 días; con `seen` lista excluye los vistos.
- [ ] **Step 2–4:** Ver fallar, implementar, pasar; tsc y lint.
- [ ] **Step 5:** Verificación visual en `next dev`: home con y sin sesión, Navbar móvil/escritorio, celebración (borrar la clave en localStorage para provocarla). Commit `feat(progreso): progreso a la vista en navbar, home y celebración de logros`.

### Task 6: Esquema y bajas del correo

**Files:**
- Create: `prisma/sql/2026-10-24-logros-correo-progreso.sql`, `src/lib/progress/emailOptOut.ts`, `src/app/api/user/progress-email/route.ts`, `src/app/api/email/progress-unsubscribe/route.ts`, `src/app/correo/baja/page.tsx`
- Modify: `prisma/schema.prisma` (modelos `ProgressEmailLog`, `ProgressEmailOptOut` + relaciones inversas en `User` y `Reservation`), `src/app/(dashboard)/perfil/progreso/page.tsx` (interruptor "Recibir un resumen por correo después de cada clase"), `src/middleware.ts` solo si hace falta para que `/correo/baja` y la ruta de baja no pidan login
- Test: `src/lib/progress/emailOptOut.test.ts`, `src/app/api/email/progress-unsubscribe/route.test.ts`

**Interfaces:**
- SQL (idempotente, solo agrega): `CREATE TABLE IF NOT EXISTS "ProgressEmailLog" ("id" TEXT PRIMARY KEY, "reservationId" TEXT NOT NULL UNIQUE REFERENCES "Reservation"("id") ON DELETE CASCADE, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)` + índice en `userId`; `CREATE TABLE IF NOT EXISTS "ProgressEmailOptOut" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`. Encabezado con instrucciones: QA primero; producción la corre José. `npx prisma generate` después de tocar el schema; `npx prisma validate` pasa.
- `emailOptOut.ts`: `export function unsubscribeToken(userId: string, secret: string): string` (HMAC-SHA256 hex de `"progress-email:" + userId`), `export function verifyUnsubscribeToken(userId: string, token: string, secret: string): boolean` (comparación en tiempo constante, false si largos distintos), `export function unsubscribeUrl(baseUrl: string, userId: string, secret: string): string`.
- `GET/PUT /api/user/progress-email` (sesión) → `{ enabled: boolean }`; PUT `{ enabled }` crea/borra la fila de `ProgressEmailOptOut` (upsert / deleteMany).
- `GET /api/email/progress-unsubscribe?u=&t=` → firma inválida o usuario inexistente: 400 con texto genérico; válida: upsert de baja y `302` a `/correo/baja`. Secreto: `NEXTAUTH_SECRET`.

- [ ] **Step 1:** Tests: token determinista y distinto por usuario; `verify` false con token alterado o de otro largo; ruta de baja 400 con firma mala (prisma mockeado no se llama), 302 con firma buena y llama upsert una vez.
- [ ] **Step 2–4:** Ver fallar, implementar, pasar; `npx prisma validate`, tsc, lint.
- [ ] **Step 5:** Commit `feat(progreso): bajas del resumen por correo y tablas nuevas`.

### Task 7: Correo de resumen y cron

**Files:**
- Create: `src/lib/progress/classSummaryEmail.ts`, `src/lib/progress/classSummaryJob.ts`, `src/app/api/cron/class-summary/route.ts`
- Modify: `vercel.json` (dos entradas `"/api/cron/class-summary"` con `"15 19 * * *"` y `"45 3 * * *"`)
- Test: `src/lib/progress/classSummaryEmail.test.ts`, `src/lib/progress/classSummaryJob.test.ts`, `src/app/api/cron/class-summary/route.test.ts`

**Interfaces:**
- Consumes: `buildProgressSummary`, `evaluateBadges`, `nextBadges`, `badgePngPath`, `unsubscribeUrl`, `sendEmail`, `getDisciplineProfile`.
- Produces:
  - `export interface ClassSummaryEmailData { firstName: string; classes: { disciplineName: string; classType: string | null; startsAt: string; minutes: number; intensity: Intensity; focus: string[]; calm: boolean }[] /*más reciente primero*/; week: { activeMinutes: number; targetMinutes: number }; streakWeeks: number; newBadges: { title: string; imageUrl: string | null }[]; nextBadge: { title: string; current: number; target: number; imageUrl: string | null } | null; progressUrl: string; unsubscribeUrl: string }`
  - `export function buildClassSummaryEmail(data: ClassSummaryEmailData): { subject: string; html: string }` — asunto `Tu resumen de {disciplineName de la más reciente}`; HTML con el estilo de los correos de `emailService.ts`; botón "Ver mi progreso"; pie con enlace de baja; escapar texto de usuario (nombre).
  - `export function newBadgesFrom(before: BadgeState[], after: BadgeState[]): BadgeState[]` (ganadas en `after` y no en `before`).
  - `export async function runClassSummaryJob(deps: { db: PrismaClient; send: typeof sendEmail; now: Date; baseUrl: string; secret: string }): Promise<{ users: number; sent: number; failed: number }>` — selecciona reservas `ATTENDED`, `isGuestReservation false`, sin `ProgressEmailLog`, cuya clase terminó en `(now-24h, now]`, de usuarias sin `ProgressEmailOptOut`; agrupa por usuaria; reclama con `createMany({ skipDuplicates: true })` y vuelve a leer cuáles reclamó esta corrida (por `id` generado aquí); arma datos con todas sus asistencias (`loadAttendedClasses` o consulta equivalente) comparando logros antes/después de las clases del correo; envía; si `send` falla, borra sus reclamos. Primer nombre = primera palabra de `User.name`.
  - Ruta cron: mismo control `CRON_SECRET` con `timingSafeEqual` que `retry-invoices`; `maxDuration = 300`; `baseUrl = NEXTAUTH_URL` (sin barra final); devuelve el resumen en JSON.

- [ ] **Step 1:** Tests: email — asunto correcto, contiene `progressUrl` y `unsubscribeUrl`, nombre con `<script>` escapado, clase de calma sin minutos activos, sin la palabra "kcal". Job (db fake en memoria o mocks de prisma): dos corridas seguidas envían una sola vez; `send` que falla deja la reserva sin reclamo; usuaria con baja no recibe; clase terminada hace 25 h no se envía; clase aún en curso no se envía; dos clases de una usuaria = 1 correo. Ruta: 401 sin/con secreto malo.
- [ ] **Step 2–4:** Ver fallar, implementar, pasar; `npm test`, tsc, lint, `npm run build`.
- [ ] **Step 5:** Commit `feat(progreso): correo de resumen después de cada clase`.
