# Selector de paquete por clase en `/reservar` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user with multiple active packages pick which one a class is booked against, tying the guest checkbox and the class deduction to the chosen package, so a shareable package (e.g. Trimestral) is never hidden by a sooner-expiring incompatible one.

**Architecture:** Extract the package↔class compatibility rule into a pure, unit-tested helper shared by the booking POST validator and a new read-only endpoint `GET /api/user/bookable-purchases?classId=…`. The `/reservar` page fetches that endpoint when the confirm modal opens, renders a selector when more than one compatible package exists, and binds the header summary, guest checkbox, and deduction to the selected package.

**Tech Stack:** Next.js App Router (route handlers), Prisma, React (client component), Vitest (node env) for the pure helper.

**Spec:** `docs/superpowers/specs/2026-05-25-reservar-package-selector-design.md`

---

## File Structure

- **Create** `src/lib/booking/packageCompatibility.ts` — pure compatibility predicate (single source of truth).
- **Create** `src/lib/booking/packageCompatibility.test.ts` — Vitest unit tests for the predicate.
- **Modify** `src/app/api/reservations/route.ts` — refactor `validatePackageAllowsClass` (lines 38-76) to delegate the decision to the new helper.
- **Create** `src/app/api/user/bookable-purchases/route.ts` — new endpoint returning compatible active packages for a class.
- **Modify** `src/app/(dashboard)/reservar/page.tsx` — types, state, fetch, selector UI, checkbox/header/deduction binding.

---

## Task 1: Pure compatibility predicate (TDD)

**Files:**
- Create: `src/lib/booking/packageCompatibility.ts`
- Test: `src/lib/booking/packageCompatibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/booking/packageCompatibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  checkPackageClassCompatibility,
  isPackageCompatibleWithClass,
} from './packageCompatibility'

describe('checkPackageClassCompatibility', () => {
  it('rejects private packages with PRIVATE_ONLY', () => {
    expect(
      checkPackageClassCompatibility({ isPrivate: true, disciplines: [] }, 'yoga')
    ).toBe('PRIVATE_ONLY')
  })

  it('returns OK for a non-private package with no discipline restriction', () => {
    expect(
      checkPackageClassCompatibility({ isPrivate: false, disciplines: [] }, 'yoga')
    ).toBe('OK')
  })

  it('returns OK when the class discipline is in the allowed list', () => {
    expect(
      checkPackageClassCompatibility(
        { isPrivate: false, disciplines: [{ disciplineId: 'yoga' }, { disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe('OK')
  })

  it('returns DISCIPLINE_NOT_COVERED when the class discipline is not allowed', () => {
    expect(
      checkPackageClassCompatibility(
        { isPrivate: false, disciplines: [{ disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe('DISCIPLINE_NOT_COVERED')
  })
})

describe('isPackageCompatibleWithClass', () => {
  it('is true only when compatibility is OK', () => {
    expect(
      isPackageCompatibleWithClass({ isPrivate: false, disciplines: [] }, 'yoga')
    ).toBe(true)
    expect(
      isPackageCompatibleWithClass({ isPrivate: true, disciplines: [] }, 'yoga')
    ).toBe(false)
    expect(
      isPackageCompatibleWithClass(
        { isPrivate: false, disciplines: [{ disciplineId: 'pilates' }] },
        'yoga'
      )
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/booking/packageCompatibility.test.ts`
Expected: FAIL — cannot resolve module `./packageCompatibility`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/booking/packageCompatibility.ts`:

```ts
/**
 * Package ↔ class compatibility for self-booked group classes.
 *
 * Single source of truth shared by:
 *   - the reservations POST validator (validatePackageAllowsClass), and
 *   - GET /api/user/bookable-purchases.
 *
 * Rules (mirrors the original validatePackageAllowsClass):
 *   1. Private packages (isPrivate) can never self-book group classes.
 *   2. If a package lists disciplines explicitly, the class discipline must be
 *      in that list. An empty list means unrestricted.
 */
export type PackageClassCompatibility =
  | 'OK'
  | 'PRIVATE_ONLY'
  | 'DISCIPLINE_NOT_COVERED'

export interface PackageForCompatibility {
  isPrivate: boolean
  disciplines: { disciplineId: string }[]
}

export function checkPackageClassCompatibility(
  pkg: PackageForCompatibility,
  classDisciplineId: string
): PackageClassCompatibility {
  if (pkg.isPrivate) return 'PRIVATE_ONLY'

  if (pkg.disciplines.length > 0) {
    const allowed = new Set(pkg.disciplines.map((d) => d.disciplineId))
    if (!allowed.has(classDisciplineId)) return 'DISCIPLINE_NOT_COVERED'
  }

  return 'OK'
}

export function isPackageCompatibleWithClass(
  pkg: PackageForCompatibility,
  classDisciplineId: string
): boolean {
  return checkPackageClassCompatibility(pkg, classDisciplineId) === 'OK'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/booking/packageCompatibility.test.ts`
Expected: PASS — 6 assertions across 2 suites.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/packageCompatibility.ts src/lib/booking/packageCompatibility.test.ts
git commit -m "feat(booking): pure package↔class compatibility helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Refactor `validatePackageAllowsClass` to use the helper

**Files:**
- Modify: `src/app/api/reservations/route.ts:38-76` (function body) and the import block at the top.

- [ ] **Step 1: Add the import**

At the top of `src/app/api/reservations/route.ts`, alongside the existing imports, add:

```ts
import { checkPackageClassCompatibility } from '@/lib/booking/packageCompatibility'
```

- [ ] **Step 2: Replace the function body**

Replace the entire current function (lines 38-76, from `async function validatePackageAllowsClass(` through its closing `}`) with:

```ts
async function validatePackageAllowsClass(
  purchaseId: string,
  classDisciplineId: string
): Promise<{ error: string; code: string } | null> {
  const pkg = await prisma.package.findFirst({
    where: { purchases: { some: { id: purchaseId } } },
    include: { disciplines: { select: { disciplineId: true } } },
  })
  if (!pkg) return null // should not happen — caller already has purchase

  const compatibility = checkPackageClassCompatibility(pkg, classDisciplineId)

  // Private packages can't self-book group classes
  if (compatibility === 'PRIVATE_ONLY') {
    return {
      error:
        'Este paquete es para sesiones privadas (1:1). ' +
        'Solicita tu sesión desde tu perfil para coordinar fecha y hora.',
      code: ERROR_CODES.PRIVATE_PACKAGE_ONLY,
    }
  }

  // Discipline restriction: build the human-readable list for the error message
  if (compatibility === 'DISCIPLINE_NOT_COVERED') {
    const allowed = new Set(pkg.disciplines.map((d) => d.disciplineId))
    const disciplineNames = await prisma.discipline.findMany({
      where: { id: { in: Array.from(allowed) } },
      select: { name: true },
    })
    const names = disciplineNames.map((d) => d.name).join(', ')
    return {
      error: `Este paquete solo cubre: ${names}. No puedes usarlo para esta clase.`,
      code: ERROR_CODES.DISCIPLINE_NOT_COVERED,
    }
  }

  return null
}
```

- [ ] **Step 3: Verify the existing tests still pass and types check**

Run: `npm run test`
Expected: PASS — all suites, including the new `packageCompatibility` tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reservations/route.ts
git commit -m "refactor(reservations): validatePackageAllowsClass uses shared helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: New endpoint `GET /api/user/bookable-purchases`

**Files:**
- Create: `src/app/api/user/bookable-purchases/route.ts`

- [ ] **Step 1: Write the route handler**

Create `src/app/api/user/bookable-purchases/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPackageCompatibleWithClass } from '@/lib/booking/packageCompatibility'

// Force dynamic - this route uses the session
export const dynamic = 'force-dynamic'

/**
 * Returns the user's active packages that are valid for a specific class,
 * sorted by earliest expiration (first item = suggested default).
 * Compatibility (private / discipline restrictions) is decided by the shared
 * helper so it never drifts from the booking POST validator.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    if (!classId) {
      return NextResponse.json({ error: 'classId requerido' }, { status: 400 })
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { disciplineId: true },
    })
    if (!classData) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
    }

    const now = new Date()
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: now },
      },
      include: {
        package: {
          include: { disciplines: { select: { disciplineId: true } } },
        },
      },
      orderBy: { expiresAt: 'asc' },
    })

    const bookablePurchases = purchases
      .filter((p) => isPackageCompatibleWithClass(p.package, classData.disciplineId))
      .map((p) => ({
        purchaseId: p.id,
        packageId: p.packageId,
        packageName: p.package.name,
        classesRemaining: p.classesRemaining,
        expiresAt: p.expiresAt.toISOString(),
        isShareable: p.package.isShareable,
        maxShares: p.package.maxShares,
      }))

    return NextResponse.json({ bookablePurchases })
  } catch (error) {
    console.error('Error fetching bookable purchases:', error)
    return NextResponse.json(
      { error: 'Error al obtener los paquetes disponibles' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test against real data**

Start the dev server if not running: `npm run dev` (background), then in a browser logged in as a test user open the network tab — or run this Prisma-level check script that mirrors the endpoint's filter for Adriana Bidegain (Trimestral + Private Flow active):

Create `scripts/_tmp_bookable_check.ts`:

```ts
import { prisma } from '../src/lib/prisma'
import { isPackageCompatibleWithClass } from '../src/lib/booking/packageCompatibility'

async function main() {
  // Adriana Bidegain
  const userId = 'cmm7vd3qr0000frmvfqblzq81'
  // Pick any upcoming group (non-private) class
  const cls = await prisma.class.findFirst({
    where: { dateTime: { gt: new Date() }, isCancelled: false },
    select: { id: true, disciplineId: true, discipline: { select: { name: true } } },
    orderBy: { dateTime: 'asc' },
  })
  if (!cls) { console.log('no upcoming class'); return }
  console.log('class:', cls.discipline.name, cls.id)

  const purchases = await prisma.purchase.findMany({
    where: { userId, status: 'ACTIVE', classesRemaining: { gt: 0 }, expiresAt: { gt: new Date() } },
    include: { package: { include: { disciplines: { select: { disciplineId: true } } } } },
    orderBy: { expiresAt: 'asc' },
  })
  const bookable = purchases.filter((p) => isPackageCompatibleWithClass(p.package, cls.disciplineId))
  console.table(bookable.map((p) => ({ pkg: p.package.name, shareable: p.package.isShareable })))
}
main().finally(() => prisma.$disconnect())
```

Run: `npx tsx scripts/_tmp_bookable_check.ts`
Expected: table lists **only** "Wellnest Trimestral (80 clases)" (shareable true); "Private Flow" is absent (filtered out as `isPrivate`).

Then delete the scratch script: `rm scripts/_tmp_bookable_check.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/bookable-purchases/route.ts
git commit -m "feat(api): bookable-purchases endpoint for per-class package selection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Client — types, state, and per-class fetch

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

- [ ] **Step 1: Extend `SelectedPurchase` and add `BookablePurchase` types**

Replace the `SelectedPurchase` interface (currently lines 73-78):

```ts
interface SelectedPurchase {
  id: string
  packageName: string
  classesRemaining: number
  expiresAt: string
}
```

with:

```ts
interface SelectedPurchase {
  id: string
  packageName: string
  classesRemaining: number
  expiresAt: string
  isShareable?: boolean
  maxShares?: number
}

interface BookablePurchase {
  purchaseId: string
  packageId: string
  packageName: string
  classesRemaining: number
  expiresAt: string
  isShareable: boolean
  maxShares: number
}
```

(`isShareable`/`maxShares` are optional on `SelectedPurchase` because the URL pre-selection flow at line ~416 sets it without those fields; the modal fetch in Step 3 always overwrites it with the full shape.)

- [ ] **Step 2: Add `bookablePurchases` state**

After the `selectedPurchase` state declaration (line 273):

```ts
  const [selectedPurchase, setSelectedPurchase] = React.useState<SelectedPurchase | null>(null)
```

add:

```ts
  const [bookablePurchases, setBookablePurchases] = React.useState<BookablePurchase[]>([])
```

- [ ] **Step 3: Add fetch + conversion helpers and wire them into `handleSelectClass`**

Add these helpers immediately above `handleSelectClass` (line 543):

```ts
  const toSelectedPurchase = (b: BookablePurchase): SelectedPurchase => ({
    id: b.purchaseId,
    packageName: b.packageName,
    classesRemaining: b.classesRemaining,
    expiresAt: b.expiresAt,
    isShareable: b.isShareable,
    maxShares: b.maxShares,
  })

  const fetchBookablePurchases = async (classId: string): Promise<BookablePurchase[]> => {
    try {
      const response = await fetch(`/api/user/bookable-purchases?classId=${classId}`)
      if (response.ok) {
        const data = await response.json()
        return (data.bookablePurchases ?? []) as BookablePurchase[]
      }
    } catch (error) {
      console.error('Error fetching bookable purchases:', error)
    }
    return []
  }
```

Then replace the current `handleSelectClass` (lines 543-559):

```ts
  const handleSelectClass = (cls: ClassData) => {
    const reservationCount = cls._count?.reservations ?? cls.currentCount
    const isFull = reservationCount >= cls.maxCapacity
    const isOnWaitlist = waitlistEntries.has(cls.id)

    setSelectedClass(cls)
    setBookingError(null)
    setWaitlistMessage(null)

    if (isOnWaitlist) {
      setModalState('waitlist-info')
    } else if (isFull) {
      setModalState('waitlist-confirm')
    } else {
      setModalState('confirm')
    }
  }
```

with:

```ts
  const handleSelectClass = async (cls: ClassData) => {
    const reservationCount = cls._count?.reservations ?? cls.currentCount
    const isFull = reservationCount >= cls.maxCapacity
    const isOnWaitlist = waitlistEntries.has(cls.id)

    setSelectedClass(cls)
    setBookingError(null)
    setWaitlistMessage(null)

    if (isOnWaitlist) {
      setModalState('waitlist-info')
    } else if (isFull) {
      setModalState('waitlist-confirm')
    } else {
      // Resolve which packages can book THIS class, then settle the selection.
      const bookable = await fetchBookablePurchases(cls.id)
      setBookablePurchases(bookable)

      const keepCurrent = bookable.find((b) => b.purchaseId === selectedPurchase?.id)
      const chosen = keepCurrent ?? bookable[0] ?? null
      setSelectedPurchase(chosen ? toSelectedPurchase(chosen) : null)

      // A non-shareable (or no) package can't carry a guest — reset guest state.
      if (!chosen?.isShareable) {
        setBringGuest(false)
        setGuestEmail('')
        setGuestName('')
      }

      setModalState('confirm')
    }
  }
```

- [ ] **Step 4: Reset `bookablePurchases` on modal close**

In `closeModal` (lines 712-724), inside the `setTimeout` callback, after `setGuestName('')` (line 720), add:

```ts
      setBookablePurchases([])
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (Note: `handleSelectClass` is now `async`; its callers use it as an event handler that ignores the returned promise, which is valid.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/reservar/page.tsx"
git commit -m "feat(reservar): fetch bookable packages per class on confirm

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Client — selector UI, checkbox/header/gating binding

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

- [ ] **Step 1: Add the package selector + zero-package message above the guest toggle**

Immediately before the guest invitation block (the `{/* Guest invitation toggle … */}` comment at line 1104), insert:

```tsx
                {/* Package selector — only when more than one package can book this class */}
                {bookablePurchases.length > 1 && (
                  <div className="border border-beige rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      ¿Con cuál paquete quieres reservar?
                    </p>
                    <div className="space-y-2">
                      {bookablePurchases.map((b) => (
                        <label
                          key={b.purchaseId}
                          className="flex items-center gap-3 cursor-pointer text-sm"
                        >
                          <input
                            type="radio"
                            name="bookable-package"
                            checked={selectedPurchase?.id === b.purchaseId}
                            onChange={() => {
                              setSelectedPurchase(toSelectedPurchase(b))
                              if (!b.isShareable) {
                                setBringGuest(false)
                                setGuestEmail('')
                                setGuestName('')
                              }
                            }}
                            className="text-primary focus:ring-primary h-4 w-4"
                          />
                          <span className="flex-1">
                            <span className="font-medium text-foreground">{b.packageName}</span>
                            <span className="block text-xs text-gray-500">
                              {b.classesRemaining} clases restantes · vence{' '}
                              {format(new Date(b.expiresAt), 'd MMM yyyy', { locale: es })}
                              {b.isShareable && ' · permite invitado'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* No compatible package for this class */}
                {bookablePurchases.length === 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    No tienes un paquete válido para esta clase. Revisa tus paquetes o adquiere uno nuevo.
                  </div>
                )}
```

(`format` and `es` are already imported and used elsewhere in this file, e.g. lines 125 and 540.)

- [ ] **Step 2: Bind the guest checkbox to the selected package**

Change the guest toggle condition (line 1105) from:

```tsx
                {activePurchase?.package?.isShareable && (
```

to:

```tsx
                {selectedPurchase?.isShareable && (
```

- [ ] **Step 3: Confirm the header already reflects the selected package (no code change)**

The header card already branches on `selectedPurchase` (lines 744-762): when set, it renders
"Usando paquete {selectedPurchase.packageName}" with `selectedPurchase.classesRemaining`.
Because Task 4 now sets `selectedPurchase` whenever the confirm modal opens (and leaves it set
after close), the header follows the chosen package automatically. The `else` branch
(lines 763-779) shows the `activePurchase` summary and is only reached before any selection
exists (page load with no URL `packageId`), which is the correct default.

No edit is required here. Verify by reading lines 744-779 and confirming the true branch reads
from `selectedPurchase`. Do **not** add a package-name line to the `else` branch — `selectedPurchase`
is null there, so it would be dead code.

- [ ] **Step 4: Gate the confirm button on having a compatible package**

Change the confirm `Button` disabled prop (line 1206) from:

```tsx
                  disabled={bringGuest && !guestEmail.trim()}
```

to:

```tsx
                  disabled={bookablePurchases.length === 0 || (bringGuest && !guestEmail.trim())}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors in `reservar/page.tsx`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/reservar/page.tsx"
git commit -m "feat(reservar): package selector wired to checkbox, header, deduction

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Build to confirm nothing is broken**

Run: `npm run build`
Expected: build succeeds (route `/api/user/bookable-purchases` appears in the output).

- [ ] **Step 2: Verify in the running app**

Run `npm run dev`, then log in (or impersonate) as each scenario and open `/reservar`, click an upcoming non-full group class:

- **Adriana Bidegain** (Trimestral shareable + Private Flow private, both active): the confirm modal shows a selector listing **only** the Trimestral (Private Flow hidden); the "Llevar un invitado" checkbox appears. Selecting it and adding a guest email lets you confirm.
- **Gabriela González Lucha** (only Trimestral active): selector is absent (single package), checkbox visible; header shows the Trimestral name + remaining.
- **A user with one non-shareable package** (e.g. an active Mini Flow only): no selector, no checkbox, header/deduction unchanged from current behavior — confirm a normal booking and verify 1 class is deducted from that package.

- [ ] **Step 3: Verify deduction binding**

As Adriana, with the Trimestral selected and a guest added, confirm the reservation. Then check the DB (or `/perfil/paquetes`) that the **Trimestral** dropped by exactly 1 class (not the Private Flow), and the reservation row has `guestEmail` set with `guestStatus = 'PENDING'`.

- [ ] **Step 4: Final confirmation**

Confirm all commits are present:

Run: `git log --oneline -6`
Expected: the five feature commits from Tasks 1-5 plus the spec commit, in order.

---

## Self-Review Notes

- **Spec coverage:** new endpoint (§Componentes 1) → Task 3; shared predicate refactor (§Componentes 2) → Tasks 1-2; client state/fetch (§Componentes 3) → Task 4; selector UI + checkbox + header + deduction (§Componentes 3, §Flujo) → Task 5; edge cases (guest reset on non-shareable, gating, 0-compatible) → Tasks 4-5; verification scenarios (§Verificación) → Task 6. `active-purchase`, admin assign, and invitation flows are untouched (§Fuera de alcance).
- **Type consistency:** `BookablePurchase` (Task 4) fields match the endpoint payload (Task 3) and `toSelectedPurchase` mapping (Tasks 4-5). `checkPackageClassCompatibility` / `isPackageCompatibleWithClass` names are identical across Tasks 1-3.
- **No placeholders:** every code/command step contains concrete content.
