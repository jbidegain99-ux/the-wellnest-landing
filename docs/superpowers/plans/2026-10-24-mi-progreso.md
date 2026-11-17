# Mi progreso — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/perfil/progreso` y atajos que muestran a cada usuaria su progreso estimado (última clase, semana, racha, mezcla de capacidades, flexibilidad/calma, hitos, meses) a partir de sus asistencias, sin medir nada.

**Architecture:** Lógica pura en `src/lib/progress/` (perfiles por disciplina + agregados) que recibe una lista de clases asistidas y una fecha "ahora" y devuelve un `ProgressSummary` serializable. Un endpoint `GET /api/user/progress` lee las reservas ATTENDED de la sesión con Prisma y devuelve ese resumen. La página cliente lo pinta con componentes propios (anillo, radar y barras en SVG), más atajos en `/perfil`, menú lateral, Navbar y manifest PWA.

**Tech Stack:** Next.js 14 App Router, next-auth 4, Prisma 5, Tailwind, lucide-react, date-fns / date-fns-tz, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-mi-progreso-design.md`

## Global Constraints

- Sin cambios de esquema ni SQL; solo lectura de `Reservation` (status `ATTENDED`, `isGuestReservation = false`) + `Class` + `Discipline`.
- Zona horaria de semanas y meses: `America/El_Salvador`; semana lunes–domingo.
- Referencia OMS: `150` minutos/semana. Rango de peso para calorías: `55`–`75` kg. Calorías activas: `(MET − 1) × kg × horas`, redondeadas a decenas.
- Hitos: `[1, 10, 25, 50, 100]`; exploradora: `3` disciplinas distintas.
- Calorías ocultas por defecto; preferencia en `localStorage` clave `wellnest:progreso:mostrarCalorias`, siempre con try/catch.
- Textos exactos: subtítulo del radar `En qué invertiste tu práctica`; pie `Estimaciones según el tipo y la duración de cada clase. No reemplazan una evaluación profesional.`; terapia de sonido sin calorías: `Clase de calma: sin gasto activo`.
- Nunca `any`. Sin librerías nuevas. Móvil primero. Componentes UI existentes (`@/components/ui/*`).
- Commits en español con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_013tb4gZ5fUquKfUpbJuwzZG`.
- El `.env` local apunta a QA: no correr scripts contra ninguna base; tests con Prisma mockeado.

## Review Focus

1. Usuaria sin clases asistidas: la página y la tarjeta de `/perfil` muestran estado vacío amable, sin errores → tests en Task 2 y Task 4.
2. Clase en domingo 23:30 hora SV (lunes UTC): cuenta en la semana correcta → test en Task 2.
3. Disciplina desconocida o `classType` nulo: perfil genérico, no rompe → test en Task 1.
4. Terapia de sonido: nunca muestra calorías, suma a calma y no a minutos activos → tests en Task 1 y Task 2.
5. El endpoint jamás devuelve datos de otra usuaria y responde 401 sin sesión → test en Task 3.

---

### Task 1: Perfiles por disciplina y métricas por clase

**Files:** Create `src/lib/progress/profiles.ts`, `src/lib/progress/profiles.test.ts`

**Interfaces — Produces:**
- `type Axis = 'fuerza' | 'flexibilidad' | 'equilibrio' | 'core' | 'energia' | 'calma'`
- `const AXES: Axis[]` (en ese orden) y `const AXIS_LABELS: Record<Axis, string>` (`Fuerza`, `Flexibilidad`, `Equilibrio`, `Core`, `Energía`, `Calma`)
- `type Intensity = 'Calma' | 'Suave' | 'Moderada' | 'Intensa'`
- `interface DisciplineProfile { met: number; intensity: Intensity; focus: string[]; weights: Record<Axis, number> }`
- `getDisciplineProfile(slug: string, classType: string | null): DisciplineProfile` — valores exactos de la tabla de la spec; yoga: `classType` (minúsculas, sin acentos) contiene `vinyasa` → MET 2.7 + Moderada; contiene `sculpt` o `power` → MET 3.0 + Moderada; si no, 2.3 + Suave. Slug desconocido → genérico.
- `estimateActiveKcal(met: number, minutes: number): { min: number; max: number } | null` — `null` si `met < 1.5`; si no, `(met − 1) × {55, 75} × minutes/60` redondeado a la decena más cercana.
- `isActiveMet(met: number): boolean` (`met >= 1.5`)

- [ ] **Step 1: Tests** (`profiles.test.ts`): pole → MET 4.5, Intensa, focus incluye `Tren superior`; pilates → weights.core 1; yoga sin tipo → 2.3/Suave; yoga `"Vinyasa✨"` → 2.7/Moderada; yoga `"Sculpt"` → 3.0; soundbath → weights.calma 1, resto 0; slug `"nuevo"` y `classType` null → genérico (3.0, focus `['Movimiento']`); `estimateActiveKcal(2.8, 50)` → `{ min: 80, max: 110 }`; `estimateActiveKcal(1.0, 55)` → `null`; `isActiveMet(1.0)` false.
- [ ] **Step 2:** `npx vitest run src/lib/progress/profiles.test.ts` → FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(progreso): perfiles por disciplina y calorías estimadas`.

### Task 2: Resumen de progreso

**Files:** Create `src/lib/progress/summary.ts`, `src/lib/progress/summary.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `interface AttendedClass { classId: string; dateTime: Date; durationMin: number; disciplineSlug: string; disciplineName: string; classType: string | null }`
  - `interface ClassSummary { classId: string; date: string /* ISO */; disciplineName: string; classType: string | null; minutes: number; intensity: Intensity; focus: string[]; kcal: { min: number; max: number } | null }`
  - `interface MonthStat { label: string /* "oct 2026" */; classes: number; minutes: number; flexMinutes: number; calmMinutes: number }`
  - `interface ProgressSummary { totalClasses: number; lastClass: ClassSummary | null; week: { activeMinutes: number; calmMinutes: number; classes: number; targetMinutes: 150 }; streak: { weeks: number; currentWeekHasClass: boolean }; mix30d: Record<Axis, number> | null; month: { current: MonthStat; previous: MonthStat }; milestones: { reached: number[]; next: number | null; remaining: number | null; explorer: { disciplines: number; reached: boolean } }; months: MonthStat[] /* 6, el más antiguo primero, incluye el actual */ }`
  - `buildProgressSummary(classes: AttendedClass[], now: Date): ProgressSummary` — clases con `dateTime > now` se ignoran (reservas futuras marcadas por error). Fórmulas exactas en la spec ("Cálculos").

- [ ] **Step 1: Tests** (`summary.test.ts`, `now` fijo `2026-10-24T18:00:00Z` = sábado):
  - `sin clases` → `totalClasses 0`, `lastClass null`, `mix30d null`, `streak.weeks 0`, `milestones.next 1`, `remaining 1`, 6 meses en cero con labels `may 2026`…`oct 2026`.
  - `última clase` = la de `dateTime` más reciente ≤ now, con kcal calculadas por Task 1.
  - `semana SV`: clase `2026-10-19T05:30:00Z` (domingo 18-oct 23:30 SV) NO cuenta en la semana actual; `2026-10-19T06:30:00Z` (lunes 00:30 SV) SÍ.
  - `soundbath` 55 min esta semana → `week.activeMinutes 0`, `week.calmMinutes 55`.
  - `racha`: clases en las semanas actual, -1 y -2, y otra en -4 → `weeks 3`, `currentWeekHasClass true`; sin clase esta semana pero en -1 y -2 → `weeks 2`, `false`.
  - `mix30d`: solo pole 60 min → `fuerza 1`, `calma ≈ 0.1`; clases de hace 31 días no cuentan.
  - `month`: 60 min de yoga en octubre → `current.flexMinutes 60`, `calmMinutes 42`; septiembre en `previous`.
  - `hitos`: 12 clases de 2 disciplinas → `reached [1, 10]`, `next 25`, `remaining 13`, `explorer { disciplines 2, reached false }`; con una 3.ª disciplina → `reached true`.
  - `clase futura` se ignora.
- [ ] **Step 2:** FAIL → **Step 3:** implementar (date-fns-tz `toZonedTime`/`formatInTimeZone`; meses con labels en español minúsculas abreviados) → **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(progreso): resumen de semana, racha, mezcla, hitos y meses`.

### Task 3: Endpoint `GET /api/user/progress`

**Files:** Create `src/app/api/user/progress/route.ts`, `src/lib/progress/load.ts`, `src/lib/progress/load.test.ts`

**Interfaces:**
- Consumes: `buildProgressSummary`, `AttendedClass` (Task 2).
- Produces: `loadAttendedClasses(userId: string): Promise<AttendedClass[]>` en `load.ts` (Prisma: `reservation.findMany` con `where { userId, status: 'ATTENDED', isGuestReservation: false }`, `select` de `class { id, dateTime, duration, classType, discipline { slug, name } }`). Ruta: obtiene la sesión como las demás rutas de `src/app/api/user/*` (mirar una existente, p. ej. `nav-badges`), 401 `{ error: 'No autorizado' }` sin `session.user.id`; si no, `NextResponse.json(buildProgressSummary(await loadAttendedClasses(id), new Date()))`. `export const dynamic = 'force-dynamic'`.

- [ ] **Step 1: Tests** (`load.test.ts`, Prisma mockeado como en otros tests del repo): `loadAttendedClasses('u1')` llama a `findMany` con el `where` exacto de arriba y mapea filas a `AttendedClass` (duration → durationMin, discipline.slug → disciplineSlug). Test de la ruta (mismo archivo o `route.test.ts`, con `getServerSession` mockeado): sin sesión → 401; con sesión `u1` → 200 y `loadAttendedClasses` llamado con `'u1'` (nunca con otro id).
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS + `npx tsc --noEmit`.
- [ ] **Step 5:** Commit `feat(progreso): endpoint de progreso de la usuaria`.

### Task 4: Página `/perfil/progreso`

**Files:** Create `src/app/(dashboard)/perfil/progreso/page.tsx`, `src/components/progress/ProgressRing.tsx`, `src/components/progress/MixRadar.tsx`, `src/components/progress/MonthBars.tsx`, `src/components/progress/useShowCalories.ts`, `src/components/progress/useShowCalories.test.ts` (si el repo tiene entorno para hooks; si no, extraer la lectura/escritura segura a `src/lib/progress/caloriesPref.ts` con test)

**Interfaces:** Consumes `ProgressSummary`, `AXES`, `AXIS_LABELS` (Tasks 1–2) y `GET /api/user/progress` (Task 3).

- [ ] **Step 1:** Leer `src/app/(dashboard)/perfil/page.tsx` y `src/app/(dashboard)/perfil/historial/page.tsx` para copiar patrón de página cliente (fetch, loading, error), tono del copy y componentes (`Card`, `Badge`, `Button`).
- [ ] **Step 2: Test** de la preferencia de calorías: `readShowCalories()` → `false` si `localStorage` lanza o no tiene la clave; `writeShowCalories(true)` guarda `'1'` en `wellnest:progreso:mostrarCalorias` y no lanza si `localStorage` falla. FAIL → implementar → PASS.
- [ ] **Step 3:** Página con las 9 secciones de la spec en ese orden, móvil primero (una columna; en `md:` dos columnas para semana/racha y radar/flex). `ProgressRing(value, target)` SVG; `MixRadar(mix: Record<Axis, number>)` SVG hexagonal con etiquetas `AXIS_LABELS`; `MonthBars(months)` barras SVG/CSS. Estado vacío: tarjeta con "Todavía no tenés/tienes clases registradas" (según tono del repo) y botón a `/reservar`. Calorías: interruptor accesible (`role="switch"`, `aria-checked`), y en la última clase muestra `≈ {min}–{max} kcal` o el texto exacto de terapia de sonido. Pie con el texto exacto.
- [ ] **Step 4:** `npx tsc --noEmit`, `npx next lint` (revertir `next-env.d.ts`), `npm test`. Verificación visual: no hay base local utilizable; renderizar los componentes SVG con datos de ejemplo en un test de snapshot ligero NO es necesario — basta revisar en QA (Task 6). Documentar en el reporte.
- [ ] **Step 5:** Commit `feat(progreso): página Mi progreso`.

### Task 5: Atajos

**Files:** Modify `src/app/(dashboard)/layout.tsx:27-34` (navigation), `src/components/layout/Navbar.tsx` (menú de usuaria escritorio ~137 y móvil ~228), `src/app/(dashboard)/perfil/page.tsx` (tarjeta arriba), `public/manifest.json`; Create `src/components/progress/LastClassCard.tsx`

- [ ] **Step 1:** Menú lateral: `{ name: 'Mi Progreso', href: '/perfil/progreso', icon: TrendingUp, badgeKey: null }` como segundo ítem. Navbar: enlace "Mi progreso" junto a "Mi perfil" en ambos menús.
- [ ] **Step 2:** `LastClassCard`: hace fetch a `/api/user/progress`, muestra última clase (disciplina, fecha, minutos, chips de foco) + botón "Ver mi progreso"; sin clases → invitación a reservar; error → no rompe la página (no renderiza nada). Montarla arriba del contenido de `/perfil`.
- [ ] **Step 3:** `manifest.json`: `shortcuts` con `{ "name": "Mi progreso", "url": "/perfil/progreso", "icons": [icon-192] }` y `{ "name": "Reservar", "url": "/reservar", ... }`; validar JSON.
- [ ] **Step 4:** `npx tsc --noEmit`, lint, `npm test` → OK. Commit `feat(progreso): atajos en perfil, menú y app instalada`.

### Task 6: PR a develop y prueba en QA (controlador)

- [ ] **Step 1:** Push `feat/mi-progreso`, PR a `develop` con la plantilla; CI verde.
- [ ] **Step 2:** Tras el merge de José, verificar en QA (URL git-develop) con la cuenta de Adriana: `/perfil` muestra la tarjeta; `/perfil/progreso` carga las 9 secciones; captura móvil (375 px) y escritorio con Playwright usando Basic Auth + login.
