# Trinity Flow (bundle) + Flow Viajero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 2 new packages to Wellnest — Trinity Flow ($60, 6 clases divididas en 2 Pole + 2 Pilates + 2 Yoga, vía bundle de 3 paquetes child ocultos) y Flow Viajero ($215, 40 clases, 60 días, todas las disciplinas).

**Architecture:** Trinity Flow se modela como un *bundle* con campo `Package.bundleChildSlugs`. Al comprarse, `markOrderPaid` crea 3 Purchases independientes (una por disciplina) en lugar de una sola; cada child Purchase está restringida a su disciplina vía `PackageDiscipline` (mecanismo existente). Cero cambios al motor de reservas. El dashboard del usuario agrupa los 3 children por `bundleGroupId` para mostrar "Trinity Flow" con desglose por disciplina. Flow Viajero es un paquete normal sin restricciones.

**Tech Stack:** Next.js App Router, Prisma 5 + PostgreSQL, vitest, date-fns, TypeScript estricto.

**Spec de referencia:** `docs/superpowers/specs/2026-05-14-trinity-bundle-and-flow-viajero-design.md`

---

## File Map

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `prisma/schema.prisma` | Modelos de datos | MODIFICAR (4 campos nuevos) |
| `scripts/seed-trinity-and-viajero.ts` | Sembrar paquetes (idempotente) | CREAR |
| `src/lib/payments/markOrderPaid.ts` | Crear Purchases al pagar | MODIFICAR (branch para bundles) |
| `src/lib/payments/markOrderPaid.test.ts` | Tests de checkout | CREAR |
| `src/app/paquetes/page.tsx` | Listado público de paquetes | MODIFICAR (filtro isHidden) |
| `src/app/api/user/purchases/route.ts` | API que lee paquetes del usuario | MODIFICAR (devolver bundle metadata) |
| `src/app/(dashboard)/perfil/paquetes/page.tsx` | Dashboard del usuario | MODIFICAR (agrupar children) |

---

## Task 1: Agregar campos de bundle al schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Agregar `isHidden` y `bundleChildSlugs` al model Package**

En `prisma/schema.prisma`, dentro del bloque `model Package`, agregar después de `isPrivate`:

```prisma
model Package {
  // ... campos existentes hasta isPrivate
  isPrivate        Boolean  @default(false)
  isHidden         Boolean  @default(false)  // oculto del listing público; permitido como child de un bundle
  bundleChildSlugs String[] @default([])     // si no vacío, este paquete es un bundle que genera N child Purchases al comprarse
  order            Int      @default(0)
  // ... resto sin cambios
}
```

- [ ] **Step 2: Agregar `bundleParentPackageId` y `bundleGroupId` al model Purchase**

Agregar al final del bloque `model Purchase` (antes de `@@index([sharedGroupId])`):

```prisma
  // Bundle metadata: si esta Purchase fue generada por la compra de un Package bundle
  bundleParentPackageId String?  // FK lógico al Package bundle padre (Trinity Flow, etc.)
  bundleGroupId         String?  // cuid generado por compra del bundle, agrupa siblings (los 3 children de Trinity Flow)

  @@index([sharedGroupId])
  @@index([bundleGroupId])
}
```

Nota: NO agregar `@relation` para `bundleParentPackageId`. Lo dejamos como FK lógico (sin enforcement de Prisma) porque el child Purchase debe sobrevivir si el bundle padre se desactiva o renombra. La resolución se hace por `findUnique({ where: { id: bundleParentPackageId } })` en el query del dashboard.

- [ ] **Step 3: Aplicar el cambio a la base de datos**

Run:
```bash
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.` y `Generated Prisma Client`. No prompts de pérdida de datos (todos los campos nuevos tienen defaults).

- [ ] **Step 4: Verificar el schema generado**

Run:
```bash
grep -A2 "isHidden\|bundleChildSlugs\|bundleParentPackageId\|bundleGroupId" prisma/schema.prisma
```

Expected: las 4 líneas nuevas aparecen en la salida.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(packages): add bundle fields to Package and Purchase

- Package.isHidden: hide from public listing
- Package.bundleChildSlugs: spawn N child Purchases on checkout
- Purchase.bundleParentPackageId: which bundle spawned this Purchase
- Purchase.bundleGroupId: groups sibling children in dashboard"
```

---

## Task 2: Script de seed para los 5 paquetes

**Files:**
- Create: `scripts/seed-trinity-and-viajero.ts`

- [ ] **Step 1: Crear el script**

Crear `scripts/seed-trinity-and-viajero.ts` con este contenido completo:

```ts
/**
 * Seed: Trinity Flow (bundle) + Flow Viajero
 *
 * Crea 3 paquetes child ocultos (trinity-pole-2, trinity-pilates-2,
 * trinity-yoga-2), el bundle visible Trinity Flow, y Flow Viajero.
 *
 * Idempotente: usa upsert por slug. Re-ejecutar es seguro.
 *
 * Uso: npx tsx scripts/seed-trinity-and-viajero.ts
 */

import { prisma } from '../src/lib/prisma'

interface ChildSpec {
  slug: string
  name: string
  disciplineSlug: string
}

const CHILDREN: ChildSpec[] = [
  { slug: 'trinity-pole-2', name: 'Trinity — Pole (2 clases)', disciplineSlug: 'pole' },
  { slug: 'trinity-pilates-2', name: 'Trinity — Pilates (2 clases)', disciplineSlug: 'pilates' },
  { slug: 'trinity-yoga-2', name: 'Trinity — Yoga (2 clases)', disciplineSlug: 'yoga' },
]

async function upsertPackage(data: {
  slug: string
  name: string
  subtitle: string
  shortDescription: string
  fullDescription: string
  classCount: number
  price: number
  validityDays: number
  bulletsTop: string[]
  bulletsBottom: string[]
  order: number
  isHidden?: boolean
  bundleChildSlugs?: string[]
}) {
  const existing = await prisma.package.findFirst({ where: { slug: data.slug } })
  const payload = {
    slug: data.slug,
    name: data.name,
    subtitle: data.subtitle,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription,
    classCount: data.classCount,
    price: data.price,
    currency: 'USD',
    validityDays: data.validityDays,
    bulletsTop: data.bulletsTop,
    bulletsBottom: data.bulletsBottom,
    order: data.order,
    isActive: true,
    isHidden: data.isHidden ?? false,
    bundleChildSlugs: data.bundleChildSlugs ?? [],
  }
  if (existing) {
    const updated = await prisma.package.update({ where: { id: existing.id }, data: payload })
    console.log(`✏  Updated: ${updated.name} (${updated.id})`)
    return updated
  }
  const created = await prisma.package.create({ data: payload })
  console.log(`✅ Created: ${created.name} (${created.id})`)
  return created
}

async function linkDiscipline(packageId: string, disciplineSlug: string) {
  const discipline = await prisma.discipline.findUnique({ where: { slug: disciplineSlug } })
  if (!discipline) throw new Error(`Discipline not found: ${disciplineSlug}`)
  await prisma.packageDiscipline.upsert({
    where: { packageId_disciplineId: { packageId, disciplineId: discipline.id } },
    update: {},
    create: { packageId, disciplineId: discipline.id },
  })
  console.log(`   ↳ linked ${discipline.name}`)
}

async function reorderExistingPackages() {
  // Renumerar para insertar trinity-flow-6 (order 3) y flow-viajero-40 (order 8)
  const remap: Array<{ slug: string; order: number }> = [
    { slug: 'ease-in', order: -2 },
    { slug: 'private-flow', order: -1 },
    { slug: 'drop-in-class', order: 1 },
    { slug: 'mini-flow-4', order: 2 },
    // trinity-flow-6 → 3 (insertado abajo)
    { slug: 'balance-pass-8', order: 4 },
    { slug: 'energia-total-12', order: 5 },
    { slug: 'apertura-full-access-24', order: 6 },
    { slug: 'wellnest-trimestral-80', order: 7 },
    // flow-viajero-40 → 8 (insertado abajo)
    { slug: 'special-balance-5', order: 9 },
  ]
  for (const { slug, order } of remap) {
    const r = await prisma.package.updateMany({ where: { slug }, data: { order } })
    if (r.count > 0) console.log(`   ↻ reordered ${slug} → ${order}`)
  }
}

async function main() {
  console.log('🌱 Seeding Trinity Flow (bundle) + Flow Viajero\n')

  console.log('— Reordering existing packages —')
  await reorderExistingPackages()
  console.log()

  console.log('— Children (hidden) —')
  for (const child of CHILDREN) {
    const pkg = await upsertPackage({
      slug: child.slug,
      name: child.name,
      subtitle: 'Componente de Trinity Flow',
      shortDescription: 'Componente de Trinity Flow',
      fullDescription: 'Paquete interno generado por la compra de Trinity Flow. No se vende directamente.',
      classCount: 2,
      price: 0,
      validityDays: 30, // ignorado en checkout (usa vigencia del bundle padre)
      bulletsTop: [],
      bulletsBottom: [],
      order: 999, // irrelevante, está oculto
      isHidden: true,
    })
    await linkDiscipline(pkg.id, child.disciplineSlug)
  }
  console.log()

  console.log('— Trinity Flow (bundle visible) —')
  const trinity = await upsertPackage({
    slug: 'trinity-flow-6',
    name: 'Trinity Flow (6 clases)',
    subtitle: 'Una combinación pensada para explorar distintas formas de bienestar',
    shortDescription: 'Una combinación pensada para explorar distintas formas de bienestar',
    fullDescription: 'Un paquete creado para que vivas una experiencia variada dentro de Wellnest, combinando fuerza, control, movilidad y conexión.',
    classCount: 6,
    price: 60,
    validityDays: 30,
    bulletsTop: ['2 clases de Pole', '2 clases de Pilates', '2 clases de Yoga'],
    bulletsBottom: [
      'Incluye 2 Pilates, 2 Yoga y 2 Pole',
      'Debe utilizarse bajo esta combinación',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
    order: 3,
    bundleChildSlugs: ['trinity-pole-2', 'trinity-pilates-2', 'trinity-yoga-2'],
  })
  // Vincular las 3 disciplinas al bundle visible (sólo para chips en el grid público)
  await linkDiscipline(trinity.id, 'pole')
  await linkDiscipline(trinity.id, 'pilates')
  await linkDiscipline(trinity.id, 'yoga')
  console.log()

  console.log('— Flow Viajero (paquete normal) —')
  await upsertPackage({
    slug: 'flow-viajero-40',
    name: 'Flow Viajero (40 clases)',
    subtitle: 'Tu práctica, tu ritmo, tu espacio',
    shortDescription: 'Tu práctica, tu ritmo, tu espacio',
    fullDescription: 'Pensado para acompañarte durante dos meses con acceso a una experiencia más completa dentro de Wellnest. Ideal para quienes quieren integrar el movimiento y el bienestar como parte real de su rutina.',
    classCount: 40,
    price: 215,
    validityDays: 60,
    bulletsTop: ['40 clases', '2 meses de vigencia', 'Todas las disciplinas incluidas'],
    bulletsBottom: [
      'Acceso a todas las disciplinas',
      'Perfecto para profundizar en tu práctica',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
    order: 8,
  })
  // Sin PackageDiscipline → todas las disciplinas (igual que Trimestral)

  console.log('\n✅ Seed complete.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Verificar slugs de disciplina existentes en DB**

Antes de correr el seed, verificar que `pole`, `pilates` y `yoga` existen como slugs de Discipline:

Run:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.discipline.findMany({ select: { slug: true, name: true } })
  .then(r => { console.log(r); return p.\$disconnect(); });
"
```

Expected: array que incluye objetos con `slug: 'pole'`, `slug: 'pilates'`, `slug: 'yoga'`. Si alguno es distinto (ej. `mat-pilates`), AJUSTAR `CHILDREN[*].disciplineSlug` y los `linkDiscipline` del bundle padre antes del Step 3.

- [ ] **Step 3: Ejecutar el seed (idempotente)**

Run:
```bash
npx tsx scripts/seed-trinity-and-viajero.ts
```

Expected:
```
🌱 Seeding Trinity Flow (bundle) + Flow Viajero
— Reordering existing packages —
   ↻ reordered ease-in → -2
   ... (varias líneas más)
— Children (hidden) —
✅ Created: Trinity — Pole (2 clases) (...)
   ↳ linked Pole
... (3 children)
— Trinity Flow (bundle visible) —
✅ Created: Trinity Flow (6 clases) (...)
   ↳ linked Pole / Pilates / Yoga
— Flow Viajero (paquete normal) —
✅ Created: Flow Viajero (40 clases) (...)
✅ Seed complete.
```

- [ ] **Step 4: Verificar idempotencia**

Run el mismo comando otra vez:
```bash
npx tsx scripts/seed-trinity-and-viajero.ts
```

Expected: ahora dice `✏ Updated:` en lugar de `✅ Created:` para los 5 paquetes. Sin errores de unique constraint en `PackageDiscipline`.

- [ ] **Step 5: Verificar el orden y los flags en DB**

Run:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.package.findMany({
  where: { OR: [{ isActive: true }, { isHidden: true }] },
  orderBy: { order: 'asc' },
  select: { slug: true, order: true, isHidden: true, bundleChildSlugs: true, price: true }
}).then(r => { console.log(JSON.stringify(r, null, 2)); return p.\$disconnect(); });
"
```

Expected: `trinity-flow-6` con `order: 3, bundleChildSlugs: ['trinity-pole-2','trinity-pilates-2','trinity-yoga-2']`; `flow-viajero-40` con `order: 8`; los 3 `trinity-*` con `isHidden: true`.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-trinity-and-viajero.ts
git commit -m "feat(seed): add Trinity Flow bundle + Flow Viajero packages

Idempotent seed for:
- 3 hidden child packages (trinity-pole-2, trinity-pilates-2, trinity-yoga-2)
- Trinity Flow bundle (\$60, classCount=6, links to all 3 children)
- Flow Viajero (\$215, 40 classes, 60d, all disciplines)

Reorders existing packages to insert Trinity Flow at order=3 and
Flow Viajero at order=8."
```

---

## Task 3: Filtrar paquetes ocultos del listing público

**Files:**
- Modify: `src/app/paquetes/page.tsx:28`

- [ ] **Step 1: Agregar `isHidden: false` al where del query**

En `src/app/paquetes/page.tsx`, línea 27-29:

```ts
const packages = await prisma.package.findMany({
  where: { isActive: true, isHidden: false },
  orderBy: { order: 'asc' },
```

- [ ] **Step 2: Verificar que el listing renderiza solo paquetes visibles**

Run:
```bash
npm run dev
```

Abrir `http://localhost:3000/paquetes` y verificar:
- Aparece "Trinity Flow (6 clases)" entre Mini Flow y Balance Pass
- Aparece "Flow Viajero (40 clases)" después de Wellnest Trimestral
- NO aparecen `trinity-pole-2`, `trinity-pilates-2`, `trinity-yoga-2`

Detener el dev server con Ctrl+C cuando termine.

- [ ] **Step 3: Commit**

```bash
git add src/app/paquetes/page.tsx
git commit -m "feat(paquetes): hide bundle child packages from public listing

Filter isHidden: false so trinity-pole-2/pilates-2/yoga-2 don't appear
on /paquetes. The Trinity Flow bundle (visible) remains."
```

---

## Task 4: Bundle branch en markOrderPaid (TDD)

**Files:**
- Modify: `src/lib/payments/markOrderPaid.ts:130-164`
- Create: `src/lib/payments/markOrderPaid.test.ts`

- [ ] **Step 1: Crear el archivo de tests con un test que falla**

Crear `src/lib/payments/markOrderPaid.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Prisma client used by markOrderPaid
const txMock = {
  paymentTransaction: { create: vi.fn() },
  purchase: { create: vi.fn() },
  promoRedemption: { findUnique: vi.fn(), create: vi.fn() },
  discountCode: { update: vi.fn() },
  order: { update: vi.fn() },
  package: { findMany: vi.fn() },
}

const prismaMock = {
  order: { findUnique: vi.fn() },
  purchase: { findFirst: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// Stub facturador to avoid network/DTE side effects
vi.mock('@/lib/facturador', () => ({
  sendToFacturador: vi.fn(async () => ({ success: true })),
}))

import { markOrderPaidAndCreatePurchase } from './markOrderPaid'

describe('markOrderPaidAndCreatePurchase — bundle packages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: facturador update succeeds
    prismaMock.purchase.update.mockResolvedValue({})
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test',
      email: 't@example.com',
      phone: null,
      documentId: null,
      documentType: null,
      fiscalAddress: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates one Purchase per child slug when bundleChildSlugs is non-empty', async () => {
    const orderId = 'order-bundle'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-trinity',
          quantity: 1,
          unitPrice: 60,
          package: {
            id: 'pkg-trinity',
            name: 'Trinity Flow (6 clases)',
            slug: 'trinity-flow-6',
            classCount: 6,
            validityDays: 30,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: ['trinity-pole-2', 'trinity-pilates-2', 'trinity-yoga-2'],
          },
        },
      ],
    })

    txMock.package.findMany.mockResolvedValue([
      { id: 'pkg-pole', slug: 'trinity-pole-2', name: 'Trinity — Pole', classCount: 2, validityDays: 30 },
      { id: 'pkg-pilates', slug: 'trinity-pilates-2', name: 'Trinity — Pilates', classCount: 2, validityDays: 30 },
      { id: 'pkg-yoga', slug: 'trinity-yoga-2', name: 'Trinity — Yoga', classCount: 2, validityDays: 30 },
    ])

    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: `purchase-${args.data.packageId}`,
      ...args.data,
      package: { id: args.data.packageId, name: 'Trinity child' },
    }))

    const result = await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })

    expect(result.success).toBe(true)
    expect(txMock.purchase.create).toHaveBeenCalledTimes(3)

    // All 3 created Purchases share the same bundleGroupId and point to bundleParentPackageId
    const calls = txMock.purchase.create.mock.calls.map((c) => c[0].data)
    const groupIds = new Set(calls.map((d) => d.bundleGroupId))
    expect(groupIds.size).toBe(1)
    expect([...groupIds][0]).toBeTruthy()

    for (const data of calls) {
      expect(data.bundleParentPackageId).toBe('pkg-trinity')
      expect(data.originalPrice).toBe(0)
      expect(data.finalPrice).toBe(0)
    }

    const packageIds = calls.map((d) => d.packageId).sort()
    expect(packageIds).toEqual(['pkg-pilates', 'pkg-pole', 'pkg-yoga'])

    // Each child got the parent's classCount=2 and parent's validityDays
    for (const data of calls) {
      expect(data.classesRemaining).toBe(2)
    }
  })

  it('uses the parent validityDays for child expiresAt, ignoring child validityDays', async () => {
    const orderId = 'order-bundle-2'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-trinity',
          quantity: 1,
          unitPrice: 60,
          package: {
            id: 'pkg-trinity',
            name: 'Trinity Flow',
            slug: 'trinity-flow-6',
            classCount: 6,
            validityDays: 30, // parent
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: ['trinity-pole-2'],
          },
        },
      ],
    })
    txMock.package.findMany.mockResolvedValue([
      { id: 'pkg-pole', slug: 'trinity-pole-2', name: 'P', classCount: 2, validityDays: 999 }, // child override should be ignored
    ])
    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'purchase-1',
      ...args.data,
      package: { id: args.data.packageId, name: 'P' },
    }))

    const before = Date.now()
    await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })
    const after = Date.now()

    const data = txMock.purchase.create.mock.calls[0][0].data
    const expiresAt = new Date(data.expiresAt as Date).getTime()
    // Should be ~30 days from now (use parent), NOT 999 days
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + thirtyDaysMs + 1000)
  })

  it('does NOT trigger bundle branch for normal packages', async () => {
    const orderId = 'order-normal'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-viajero',
          quantity: 1,
          unitPrice: 215,
          package: {
            id: 'pkg-viajero',
            name: 'Flow Viajero',
            slug: 'flow-viajero-40',
            classCount: 40,
            validityDays: 60,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: [], // empty → normal
          },
        },
      ],
    })
    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'purchase-normal',
      ...args.data,
      package: { id: 'pkg-viajero', name: 'Flow Viajero' },
    }))

    await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })

    // package.findMany should NOT be called (no bundle to resolve)
    expect(txMock.package.findMany).not.toHaveBeenCalled()
    // Exactly 1 Purchase, no bundle metadata
    expect(txMock.purchase.create).toHaveBeenCalledTimes(1)
    const data = txMock.purchase.create.mock.calls[0][0].data
    expect(data.bundleGroupId).toBeUndefined()
    expect(data.bundleParentPackageId).toBeUndefined()
    expect(data.classesRemaining).toBe(40)
    expect(data.originalPrice).toBe(215)
  })
})
```

- [ ] **Step 2: Run los tests para confirmar que fallan**

Run:
```bash
npx vitest run src/lib/payments/markOrderPaid.test.ts
```

Expected: FAIL (los 3 tests fallan porque la lógica de bundles no existe). Mensaje típico: `purchase.create` fue llamado 1 vez en lugar de 3, o no setea `bundleGroupId`.

- [ ] **Step 3: Implementar la branch de bundles en markOrderPaid**

Editar `src/lib/payments/markOrderPaid.ts`. Agregar import:

```ts
import { randomUUID } from 'crypto'
```

Reemplazar el bloque `// 4b. Create Purchase records for each order item` (líneas ~129-164) por:

```ts
      // 4b. Create Purchase records for each order item
      const purchases = []
      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          // Calculate discount per unit if applicable
          const originalPrice = item.unitPrice
          const discountPercentage = order.discountCodeRef?.percentage ?? 0
          const finalPrice = originalPrice * (1 - discountPercentage / 100)

          // Bundle branch: spawn one Purchase per child slug instead of a parent Purchase
          if (item.package.bundleChildSlugs && item.package.bundleChildSlugs.length > 0) {
            const bundleGroupId = randomUUID()
            const children = await tx.package.findMany({
              where: { slug: { in: item.package.bundleChildSlugs } },
            })
            if (children.length !== item.package.bundleChildSlugs.length) {
              const found = children.map((c) => c.slug)
              const missing = item.package.bundleChildSlugs.filter((s) => !found.includes(s))
              throw new Error(`Bundle ${item.package.slug ?? item.package.id}: missing child packages: ${missing.join(', ')}`)
            }
            for (const child of children) {
              const purchase = await tx.purchase.create({
                data: {
                  userId: order.userId,
                  packageId: child.id,
                  classesRemaining: child.classCount,
                  expiresAt: addDays(new Date(), item.package.validityDays), // PADRE
                  originalPrice: 0, // dinero vive en la Order
                  finalPrice: 0,
                  discountCode: order.discountCode || null,
                  status: 'ACTIVE',
                  paymentProviderId: `${provider.toLowerCase()}_${orderId}_${item.id}_${i}_${child.slug}`,
                  bundleParentPackageId: item.package.id,
                  bundleGroupId,
                },
                include: { package: true },
              })
              purchases.push({
                id: purchase.id,
                packageId: purchase.packageId,
                packageName: purchase.package.name,
                classesRemaining: purchase.classesRemaining,
                expiresAt: purchase.expiresAt,
                finalPrice: purchase.finalPrice,
              })
            }
            continue // skip the normal create for this item
          }

          const purchase = await tx.purchase.create({
            data: {
              userId: order.userId,
              packageId: item.packageId,
              classesRemaining: item.package.classCount,
              expiresAt: addDays(new Date(), item.package.validityDays),
              originalPrice,
              finalPrice,
              discountCode: order.discountCode || null,
              status: 'ACTIVE',
              paymentProviderId: `${provider.toLowerCase()}_${orderId}_${item.id}_${i}`,
            },
            include: {
              package: true,
            },
          })

          purchases.push({
            id: purchase.id,
            packageId: purchase.packageId,
            packageName: purchase.package.name,
            classesRemaining: purchase.classesRemaining,
            expiresAt: purchase.expiresAt,
            finalPrice: purchase.finalPrice,
          })
        }
      }
```

Justificación:
- `randomUUID()` viene del módulo `crypto` builtin de Node — no necesita instalar nada.
- `originalPrice: 0, finalPrice: 0` para los children → `triggerFacturacion` los filtra automáticamente (línea 304: `purchases.filter((p) => p.finalPrice > 0)`), así que no se factura el child individualmente. La Order ya facturará el monto del bundle ($60) cuando alguien añada esa lógica (fuera de este scope).
- `paymentProviderId` incluye el slug del child para no colisionar con el `unique` index de Purchases por `paymentProviderId` (si lo hay).

- [ ] **Step 4: Run los tests para confirmar que pasan**

Run:
```bash
npx vitest run src/lib/payments/markOrderPaid.test.ts
```

Expected: PASS los 3 tests.

- [ ] **Step 5: Run el test suite completo para regresión**

Run:
```bash
npx vitest run
```

Expected: todos los tests pasan (los nuevos + los 3 archivos existentes).

- [ ] **Step 6: Verificar que TypeScript compila**

Run:
```bash
npx tsc --noEmit
```

Expected: sin errores. Si aparece error sobre `bundleChildSlugs` en `item.package`, asegurate que `prisma generate` corrió en Task 1 Step 3.

- [ ] **Step 7: Commit**

```bash
git add src/lib/payments/markOrderPaid.ts src/lib/payments/markOrderPaid.test.ts
git commit -m "feat(payments): spawn child Purchases for bundle packages

When an OrderItem.package has non-empty bundleChildSlugs:
- Resolve each child Package by slug
- Create one Purchase per child with classesRemaining = child.classCount
- All children share a bundleGroupId; bundleParentPackageId points to the bundle
- expiresAt uses the PARENT's validityDays (not the child's)
- originalPrice/finalPrice = 0 (money lives in the Order)
- DTE invoicing skips them automatically via finalPrice > 0 filter

Tests cover: 3 children created with shared groupId, parent validityDays
override, normal packages bypass the branch."
```

---

## Task 5: Devolver bundle metadata desde la API del usuario

**Files:**
- Modify: `src/app/api/user/purchases/route.ts`

- [ ] **Step 1: Incluir bundleParentPackageId/bundleGroupId en el query y resolver el Package padre**

En `src/app/api/user/purchases/route.ts`, modificar el query principal y agregar la resolución del Package padre. Reemplazar el bloque que va desde `const purchases = await prisma.purchase.findMany(...)` hasta el cierre del `mapPurchase` por:

```ts
    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: {
        package: {
          include: {
            disciplines: { include: { discipline: true } },
          },
        },
        reservations: {
          include: {
            class: {
              include: {
                instructor: true,
                discipline: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { status: 'asc' },
        { expiresAt: 'asc' },
      ],
    })

    // Resolve bundle parent Packages (used to render group title and bullets)
    const parentIds = Array.from(new Set(
      purchases.map((p) => p.bundleParentPackageId).filter(Boolean) as string[]
    ))
    const parentPackages = parentIds.length > 0
      ? await prisma.package.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, name: true, classCount: true, validityDays: true },
        })
      : []
    const parentById = new Map(parentPackages.map((p) => [p.id, p]))
```

Luego, dentro de `mapPurchase`, agregar al objeto que retorna (después de `sharedWith`):

```ts
        bundleGroupId: p.bundleGroupId,
        bundleParentPackageId: p.bundleParentPackageId,
        bundleParentName: p.bundleParentPackageId
          ? parentById.get(p.bundleParentPackageId)?.name ?? null
          : null,
        bundleParentClassCount: p.bundleParentPackageId
          ? parentById.get(p.bundleParentPackageId)?.classCount ?? null
          : null,
        disciplineName: p.package.disciplines[0]?.discipline.name ?? null,
```

(El `disciplineName` solo es informativo cuando el paquete tiene exactamente 1 disciplina, como los children. En paquetes "todas las disciplinas" será null y la UI lo ignora.)

- [ ] **Step 2: Verificar TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: sin errores. Si aparece error en `mapPurchase` por la firma de retorno, agregar los nuevos campos al tipado intermedio si lo hubiera (revisar las primeras 30 líneas del archivo).

- [ ] **Step 3: Smoke test manual del endpoint**

Run:
```bash
npm run dev
```

En otra terminal, autenticarse en el navegador, luego:
```bash
curl -s http://localhost:3000/api/user/purchases -H "Cookie: <pegá la cookie de session aquí>" | jq '.activePurchases[] | {packageName, bundleGroupId, bundleParentName, disciplineName, classesRemaining}'
```

Expected: si hay una Purchase de Trinity Flow comprada, ves 3 entries con el mismo `bundleGroupId`, `bundleParentName: "Trinity Flow (6 clases)"`, y `disciplineName` igual a "Pole" / "Pilates" / "Yoga". Si no hay compras de Trinity Flow todavía, no aparecen — eso es OK, lo verificás en Task 6.

Detener el dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/purchases/route.ts
git commit -m "feat(api): expose bundle metadata in /api/user/purchases

Adds bundleGroupId, bundleParentPackageId, bundleParentName,
bundleParentClassCount, and disciplineName per Purchase. The dashboard
uses these to group bundle child Purchases as a single 'Trinity Flow'
card with per-discipline breakdown."
```

---

## Task 6: Agrupar bundle children en el dashboard

**Files:**
- Modify: `src/app/(dashboard)/perfil/paquetes/page.tsx`

- [ ] **Step 1: Extender la interfaz `Purchase` con los campos nuevos**

En `src/app/(dashboard)/perfil/paquetes/page.tsx`, líneas 17-32, reemplazar la interfaz `Purchase` por:

```ts
interface Purchase {
  id: string
  packageId: string
  packageName: string
  classesTotal: number
  classesRemaining: number
  classesUsed: number
  expiresAt: string
  purchasedAt: string
  status: string
  isPrivate?: boolean
  isShared?: boolean
  isChild?: boolean
  sharedByName?: string | null
  sharedWith?: SharedWith[]
  // Bundle metadata
  bundleGroupId?: string | null
  bundleParentPackageId?: string | null
  bundleParentName?: string | null
  bundleParentClassCount?: number | null
  disciplineName?: string | null
}
```

- [ ] **Step 2: Agregar tipo discriminado para grouped items y un agrupador**

Después de la interfaz `Purchase`, antes de `interface PurchasesData`, agregar:

```ts
interface BundleGroup {
  kind: 'bundle'
  groupId: string
  parentName: string
  parentClassCount: number
  expiresAt: string
  children: Array<{
    purchaseId: string
    disciplineName: string
    remaining: number
    total: number
  }>
}

interface SinglePurchase {
  kind: 'single'
  purchase: Purchase
}

type GroupedItem = BundleGroup | SinglePurchase

function groupActivePurchases(purchases: Purchase[]): GroupedItem[] {
  const grouped: GroupedItem[] = []
  const bundleMap = new Map<string, BundleGroup>()

  for (const p of purchases) {
    if (p.bundleGroupId && p.bundleParentName) {
      let bundle = bundleMap.get(p.bundleGroupId)
      if (!bundle) {
        bundle = {
          kind: 'bundle',
          groupId: p.bundleGroupId,
          parentName: p.bundleParentName,
          parentClassCount: p.bundleParentClassCount ?? 0,
          expiresAt: p.expiresAt,
          children: [],
        }
        bundleMap.set(p.bundleGroupId, bundle)
        grouped.push(bundle)
      }
      bundle.children.push({
        purchaseId: p.id,
        disciplineName: p.disciplineName ?? p.packageName,
        remaining: p.classesRemaining,
        total: p.classesTotal,
      })
    } else {
      grouped.push({ kind: 'single', purchase: p })
    }
  }
  return grouped
}
```

- [ ] **Step 3: Reemplazar el render de `activePurchases.map(...)` por el render agrupado**

En la sección "Active Packages", líneas 205-294 (el bloque dentro del `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">`), reemplazar el `activePurchases.map((purchase) => { ... })` por:

```tsx
            {groupActivePurchases(activePurchases).map((item) => {
              if (item.kind === 'bundle') {
                const expiresDate = new Date(item.expiresAt)
                const daysRemaining = getDaysRemaining(expiresDate)
                const totalRemaining = item.children.reduce((s, c) => s + c.remaining, 0)
                const isLowClasses = totalRemaining <= 2
                const isExpiringSoon = daysRemaining <= 7
                return (
                  <Card key={item.groupId} className="overflow-hidden">
                    <div className="h-2 bg-primary" />
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{item.parentName}</CardTitle>
                        <Badge variant="success">Activo</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {item.children.map((c) => (
                          <div key={c.purchaseId}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-700">{c.disciplineName}</span>
                              <span className="font-medium">
                                {c.remaining} / {c.total}
                              </span>
                            </div>
                            <div className="h-1.5 bg-beige rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(c.remaining / c.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between text-sm pt-2 border-t border-beige">
                        <span className="text-gray-600">Total clases restantes</span>
                        <span className="font-medium">
                          {totalRemaining} de {item.parentClassCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">
                          Vence el {formatDate(expiresDate)}
                        </span>
                        {isExpiringSoon && (
                          <Badge variant="warning">{daysRemaining} días</Badge>
                        )}
                      </div>

                      {(isLowClasses || isExpiringSoon) && (
                        <div className="flex items-start gap-2 p-3 bg-[var(--color-warning)]/10 rounded-lg text-sm">
                          <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
                          <span className="text-gray-700">
                            {isLowClasses && isExpiringSoon
                              ? 'Pocas clases y poco tiempo restante'
                              : isLowClasses
                              ? 'Te quedan pocas clases'
                              : 'Tu paquete vence pronto'}
                          </span>
                        </div>
                      )}

                      <Link href="/reservar">
                        <Button variant="outline" className="w-full">
                          Reservar Clase
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )
              }

              const purchase = item.purchase
              const expiresDate = new Date(purchase.expiresAt)
              const daysRemaining = getDaysRemaining(expiresDate)
              const isLowClasses = purchase.classesRemaining <= 2
              const isExpiringSoon = daysRemaining <= 7

              return (
                <Card key={purchase.id} className="overflow-hidden">
                  <div className="h-2 bg-primary" />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{purchase.packageName}</CardTitle>
                      <div className="flex gap-1">
                        {purchase.isShared && (
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            Compartido
                          </Badge>
                        )}
                        <Badge variant="success">Activo</Badge>
                      </div>
                    </div>
                    {purchase.isChild && purchase.sharedByName && (
                      <p className="text-xs text-gray-500 mt-1">
                        Compartido por {purchase.sharedByName}
                      </p>
                    )}
                    {!purchase.isChild && purchase.sharedWith && purchase.sharedWith.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Compartido con {purchase.sharedWith.map((s) => s.userName || 'Sin nombre').join(', ')}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Clases restantes</span>
                        <span className="font-medium">
                          {purchase.classesRemaining} de {purchase.classesTotal}
                        </span>
                      </div>
                      <div className="h-2 bg-beige rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${(purchase.classesRemaining / purchase.classesTotal) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">
                        Vence el {formatDate(expiresDate)}
                      </span>
                      {isExpiringSoon && (
                        <Badge variant="warning">{daysRemaining} días</Badge>
                      )}
                    </div>

                    {(isLowClasses || isExpiringSoon) && (
                      <div className="flex items-start gap-2 p-3 bg-[var(--color-warning)]/10 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
                        <span className="text-gray-700">
                          {isLowClasses && isExpiringSoon
                            ? 'Pocas clases y poco tiempo restante'
                            : isLowClasses
                            ? 'Te quedan pocas clases'
                            : 'Tu paquete vence pronto'}
                        </span>
                      </div>
                    )}

                    <Link href={`/reservar?packageId=${purchase.id}`}>
                      <Button variant="outline" className="w-full">
                        Reservar Clase
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
```

Notas sobre el render del bundle:
- El botón "Reservar Clase" del bundle linkea a `/reservar` SIN `packageId` específico, porque el usuario debe elegir disciplina primero y el endpoint elige automáticamente la child Purchase correcta. El usuario único (no-bundle) sí pasa el `packageId` (comportamiento existente preservado).
- El `<Badge>` "Compartido" no se muestra para bundles — Trinity Flow no es shareable en este scope.

- [ ] **Step 4: Verificar TypeScript**

Run:
```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Smoke test manual end-to-end**

Esto requiere una compra real de Trinity Flow para ver el render. Si no se puede simular checkout, crear una Purchase directamente en DB:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const p = new PrismaClient();
(async () => {
  const userId = '<TU_USER_ID>';
  const trinity = await p.package.findUnique({ where: { slug: 'trinity-flow-6' } });
  const children = await p.package.findMany({ where: { slug: { in: trinity.bundleChildSlugs } } });
  const groupId = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  for (const child of children) {
    await p.purchase.create({
      data: {
        userId, packageId: child.id, classesRemaining: child.classCount,
        expiresAt, originalPrice: 0, finalPrice: 0, status: 'ACTIVE',
        paymentProviderId: 'manual_smoke_' + child.slug,
        bundleParentPackageId: trinity.id, bundleGroupId: groupId,
      },
    });
  }
  console.log('Created 3 child purchases for Trinity Flow, groupId=' + groupId);
  await p.\$disconnect();
})();
"
```

Reemplazar `<TU_USER_ID>` con el ID del usuario logueado. Luego:

```bash
npm run dev
```

Abrir `http://localhost:3000/perfil/paquetes`. Verificar:
- Aparece UNA card titulada "Trinity Flow (6 clases)"
- Adentro hay 3 barras: Pole 2/2, Pilates 2/2, Yoga 2/2
- Total: 6 de 6 clases
- Fecha de vencimiento ~30 días
- El botón "Reservar Clase" funciona (lleva a `/reservar`)

Limpiar las Purchases manuales después del test:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.purchase.deleteMany({ where: { paymentProviderId: { startsWith: 'manual_smoke_' } } })
  .then((r) => { console.log('Deleted', r.count); return p.\$disconnect(); });
"
```

- [ ] **Step 6: Verificar que paquetes no-bundle siguen funcionando**

En el mismo dashboard, confirmar que los paquetes existentes del usuario (si los hay) renderizan igual que antes — una sola barra de progreso, badges Compartido/Activo, link `/reservar?packageId=...` con su ID.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(dashboard)/perfil/paquetes/page.tsx'
git commit -m "feat(perfil): group bundle child Purchases as Trinity Flow card

Children sharing a bundleGroupId render as a single Card with the
parent Package name as title and per-discipline progress bars
(Pole/Pilates/Yoga). Total remaining = sum of children. Normal
Purchases still render with the existing single-bar layout."
```

---

## Task 7: Verificación final end-to-end

**Files:** ninguno (verificación)

- [ ] **Step 1: Run el test suite completo**

Run:
```bash
npx vitest run
```

Expected: todos los tests pasan.

- [ ] **Step 2: Type check completo**

Run:
```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Verificación visual del listing público**

```bash
npm run dev
```

Abrir `/paquetes`:
- Ver Trinity Flow (6 clases) — $60 — entre Mini Flow y Balance Pass
- Ver Flow Viajero (40 clases) — $215 — después de Trimestral
- NO ver `trinity-pole-2`, `trinity-pilates-2`, `trinity-yoga-2`

- [ ] **Step 4: Verificación del dashboard del usuario**

Si hay una compra real (o smoke test del Step 5 de Task 6) de Trinity Flow:
- `/perfil/paquetes` muestra UNA card "Trinity Flow" con 3 desgloses
- Reservar una clase de Pole desde `/reservar` decrementa solo el saldo de Pole, no Pilates/Yoga

- [ ] **Step 5: Documentar lo done**

Ningún commit nuevo aquí. Reportá al usuario:
- Los 5 commits de tasks 1-6 con sus hashes
- Confirmación de que los nuevos paquetes están live en DB
- Instrucción de deploy: `git push` + `prisma db push` en prod (igual que cualquier cambio de schema en este repo)
