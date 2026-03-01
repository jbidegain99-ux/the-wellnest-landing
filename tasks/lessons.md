# Lessons Learned: Favicon + Paquetes de Apertura

## Favicon en Next.js App Router
- `src/app/icon.svg` is auto-detected by Next.js as the favicon — no need for favicon.ico
- `src/app/apple-icon.tsx` uses `ImageResponse` from `next/og` for dynamic PNG generation (180x180)
- Also placed SVG in `public/favicon.svg` as fallback
- Configured explicit `icons` in metadata for clarity

## Package Schema Extension
- Added nullable `originalPrice` (Float?) and `discountPercent` (Int?) to avoid breaking existing packages
- `prisma db push` was sufficient — no formal migration needed for additive nullable fields

## Seed Strategy
- Created separate apertura packages (new slugs: `apertura-*`) instead of modifying existing ones
- Deactivated old packages via `isActive: false` — data preserved, just hidden from public queries
- Trimestral excluded from deactivation via `slug: { not: 'wellnest-trimestral-80' }`
- Updated Trimestral's order to 6 so it appears after apertura packages

## UI Implementation
- Discount badge uses gold/mustard `#C4943D` for contrast against white card
- Header changes from gradient to solid sage green `#6B7F5E` when package has discount
- `line-through` on original price with `text-gray-400` for subtlety
- Conditional rendering: `hasDiscount = pkg.originalPrice && pkg.discountPercent`

## Admin API
- Updated `OFFICIAL_PACKAGE_SLUGS` to include apertura slugs
- Added `originalPrice` and `discountPercent` to zod validation schema

## Dashboard/Admin Cleanup (Mar 2026)
- `src/app/admin/page.tsx`: Removed "Herramientas de Administración" Card + SeedDatabaseButton import
- `src/app/admin/configuracion/page.tsx`: Removed entire "Administración de Base de Datos" Card (Poblar/Limpiar buttons + handlers + state)
- Unused imports cleaned: Database, AlertTriangle, Trash2, Settings

## Schedule Loading Scripts (Mar 2026)
- Scripts at `scripts/load-test-schedules.ts`, `load-fixed-schedule-week9-14.ts`, `load-fixed-schedule-week16-21.ts`
- Excel source: `tasks/prompts/Horarios de Prueba y Clases Semanal (1).xlsx` (3 sheets)
- **Excel time gotcha**: Some times stored as fractional numbers (e.g., 0.354 = 08:30), not strings
- Class model: `disciplineId` + `instructorId` as FK refs, `dateTime` (UTC), `duration` (minutes), `maxCapacity`, `classType`, `notes`
- Data loaded: 12 test (4-7 Mar) + 37 regular week 9-14 + 37 regular week 16-21 = 86 new classes
- **"Aro y Telas" discipline had empty string ID** — fixed by delete + recreate
- Missing instructors created: Dani, Jaime, Vicky, Jessica (upsert pattern)
- "Nicolle y Adri" combo instructor → mapped to instructor-nicolle (single FK constraint)
- "Pole Flow" discipline mapped to "pole" (Pole Fitness) since no separate discipline exists
- Use `Date.UTC()` for dateTime to avoid timezone issues

## Dashboard: Mock Data → Real DB Queries (Mar 2026)
- Admin dashboard was entirely hardcoded mock data — replaced with real Prisma queries
- Made it an `async` server component (no 'use client') — Prisma queries run directly in component
- El Salvador timezone (UTC-6) must be accounted for in date ranges (today, week, month)
- Used `Promise.all()` for 9 parallel DB queries for performance
- Popular classes: `prisma.reservation.groupBy` by classId, then aggregate by discipline name
- Empty states for all sections when no data exists

## Complementary Disciplines Feature (Mar 2026)
- Added `complementaryDisciplineId String?` to Class model as optional FK to Discipline
- Discipline model needs named relations: `@relation("PrimaryDiscipline")` and `@relation("ComplementaryDiscipline")` to disambiguate two FK refs to same table
- `prisma db push` sufficient for additive nullable field
- Public API filter uses `OR: [{ disciplineId }, { complementaryDisciplineId }]` to search both fields
- Validation: complementary must differ from primary, both must exist in DB
- Scripts updated: `mapDisciplineSlug()` → `mapDisciplineSlugs()` returns `{ primary, complementary }` tuple
- "Yoga + Soundbath" → primary: yoga, complementary: soundbath
- UI: admin form has checkbox toggle + filtered secondary dropdown (excludes primary from options)
- Display: cards show "Discipline + Complementary" when complementary exists, mobile uses dual badges

## Timezone Bug Fix: Scripts + PUT endpoint (Mar 2026)
- **Root cause**: Scripts used `Date.UTC(y, m, d, hh, mm)` storing El Salvador local time AS UTC → 6 hours too early
- **Fix**: Add `hh + 6` (EL_SALVADOR_UTC_OFFSET) in scripts' `Date.UTC()` call
- **PUT endpoint had same bug**: Used `date-fns` `setHours/setMinutes` which operates in server-local timezone, not UTC+offset
- **PUT fix**: Extract El Salvador date from existing class, reconstruct with `Date.UTC(..., hours + 6, minutes)`
- **Result**: 17:00 El Salvador → stored as 23:00 UTC → `getElSalvadorTime()` subtracts 6h → displays 17:00 correctly
- **Key insight**: Admin POST endpoint was already correct (`hours + EL_SALVADOR_UTC_OFFSET`), only PUT and scripts were wrong

## formatClassType Helper (Mar 2026)
- Created `formatClassType()` in `src/lib/utils.ts` — maps "test" → "Clase de Prueba", "regular" → "Clase Regular"
- Applied in 5 files: admin horarios, public horarios (mobile + desktop), admin asistencias list + detail
- Only visual change — DB still stores "test"/"regular" as-is
