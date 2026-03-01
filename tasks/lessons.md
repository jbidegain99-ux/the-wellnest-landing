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
