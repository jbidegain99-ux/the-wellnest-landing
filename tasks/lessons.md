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

## Migración PayWay a Producción (2 Mar 2026)

### Cambios realizados
- Variables de entorno actualizadas en Vercel (Production only) via CLI
- `PAYWAY_ENV=PROD` (el código compara contra `"PROD"`, no `"production"`)
- Texto "Procesado por Stripe" actualizado a "PayWay" en carrito
- Campo `stripePaymentId` renombrado a `paymentProviderId` usando `@map("stripePaymentId")` — sin migración de BD

### Credenciales de Producción
- ID Comercio: 1711
- Usuario Operación: PAGOS.THE.WELLNEST
- Base URL: https://www.payway.sv
- Callback URL: https://wellneststudio.net

### Detalles técnicos
- `@map()` en Prisma permite renombrar el campo en código sin tocar la columna de BD
- Variables de Dev/Preview mantienen valores de test (rollback: cambiar `PAYWAY_ENV=TEST`)
- Usar `printf` (no `echo`) con `vercel env add` para evitar newlines que rompen valores
- PayWay ya estaba 100% implementado, solo faltaba cambiar credenciales de test a producción

### Archivos modificados
- `prisma/schema.prisma` — `paymentProviderId @map("stripePaymentId")`
- `src/app/(dashboard)/carrito/page.tsx` — texto Stripe → PayWay
- `src/lib/payments/markOrderPaid.ts` — usa `paymentProviderId`
- `src/app/api/checkout/route.ts` — usa `paymentProviderId`
- `src/app/api/packages/claim-trial/route.ts` — usa `paymentProviderId`

### Rollback
Si hay problemas: cambiar `PAYWAY_ENV=TEST` en Vercel Production y redeploy

## Welcome to Wellnest Package (Mar 2026)
- New introductory package: "Welcome to Wellnest (2 clases)" at $15, slug `welcome-to-wellnest-2`
- Schema field mapping: `validityDays` (not `durationDays`), `order` (not `displayOrder`)
- No `finalPrice` or `badge` field on Package model — those exist only on Purchase
- `bulletsTop`/`bulletsBottom` are `String[]` (Postgres arrays, not JSON)
- Set `order: 0` to position first (existing packages start at `order: 1`)
- Added slug to `OFFICIAL_PACKAGE_SLUGS` in both `/api/packages/route.ts` and `/api/admin/cleanup/route.ts`
- Seed script: `scripts/seed-welcome-package.ts` (idempotent via slug lookup)
- Use `npx tsx` (not `npx ts-node`) to run scripts — ESM module format issues with ts-node

## Single Purchase Restriction (Mar 2026)
- Added `singlePurchaseOnly Boolean @default(false)` to Package model
- Replaces hardcoded `price === 0` checks across checkout, cart, claim-trial, and paquetes UI
- **Audit found**: 1 duplicate for trial package (Jose, admin/test), 1 duplicate for Welcome package (Vanessa — same-second race condition via markOrderPaid)
- Policy: existing duplicates are NOT reverted, only future duplicates blocked
- Validation added in 4 backend paths: `/api/checkout`, `/api/cart`, `/api/packages/claim-trial`, `markOrderPaid.ts` (PayWay callback)
- `markOrderPaid.ts` had NO single-purchase check before — critical gap for PayWay payments
- New endpoint: `GET /api/packages/[packageId]/purchase-status` for frontend pre-check
- UI: `purchasedTrialPackageIds` prop renamed to `purchasedSinglePackageIds`, uses `singlePurchaseOnly` field instead of `price === 0`
- Error code unified to `SINGLE_PURCHASE_LIMIT` (was `TRIAL_PACKAGE_LIMIT_EXCEEDED`)
- Used `prisma db push` (not `migrate dev`) — Accelerate proxy doesn't support interactive migrate

## Vigency Extension & Package Deduction (Mar 2026)

### What was done:
- Identified all Purchase records created before 2026-03-09T06:00:00Z (class start in SV time)
- Extended expiresAt to 2026-04-10T05:59:59Z (= 2026-04-09T23:59:59 SV time) for affected users
- Implemented bidirectional package management: admin can now ADD or DEDUCT classes from user purchases
- Added audit logging for all deduction actions (via console.log in production)

### Key learnings:
- Pre-class presales cause vigency misalignment — in future, sync purchase date with class start date
- Timezone conversion: 9-Abr 23:59:59 SV = 10-Abr 05:59:59 UTC (UTC-6 fixed offset)
- Purchase model tracks balance (classesRemaining), not Order — Order is only for payment gateway tracking
- Deduction sets status to DEPLETED when classesRemaining reaches 0
- Migration scripts should support --dry-run flag for safe testing before applying changes

### Files changed:
- `scripts/audit-pre-march-packages.ts` (new) — audit script
- `scripts/migrate-extend-vigency.ts` (new) — migration script with --dry-run support
- `src/app/api/admin/users/[id]/deduct-package/route.ts` (new) — deduction endpoint
- `src/app/api/admin/users/[id]/purchases/route.ts` (new) — user purchases list endpoint
- `src/app/admin/usuarios/page.tsx` (updated) — added deduction modal to admin UI
