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
