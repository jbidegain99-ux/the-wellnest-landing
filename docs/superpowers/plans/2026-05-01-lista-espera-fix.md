# Lista de Espera: UI Interactiva + Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where full classes appear grayed-out with no interaction, allow users to join/leave the waitlist from `/reservar`, and email users when an auto-assigned spot opens.

**Architecture:** Frontend changes in the existing booking page (`/reservar`) reuse the existing waitlist API and the existing modal pattern. A new HTML email template lives next to the others in `src/lib/emailService.ts`. Both cancellation endpoints (user + admin) trigger auto-assignment + email.

**Tech Stack:** Next.js 14 App Router, Prisma, NextAuth, Microsoft Graph (email), Tailwind, Vitest (unit tests for pure utilities only — no API tests in this repo).

**Spec:** `docs/superpowers/specs/2026-05-01-lista-espera-fix-design.md`

---

## File Map

- **Modify** `src/lib/emailService.ts` — new template + export of `formatDateTimeShort`
- **Create** `src/lib/emailService.test.ts` — unit test for the new template
- **Modify** `src/app/api/waitlist/route.ts` — POST validations
- **Modify** `src/app/api/reservations/cancel/route.ts` — fire email after auto-assign
- **Modify** `src/app/api/admin/attendance/cancel-reservation/route.ts` — replicate auto-assign + email
- **Modify** `src/app/(dashboard)/reservar/page.tsx` — three states + modals + waitlist fetch
- **Modify** `src/app/(dashboard)/perfil/espera/page.tsx` — update notice

---

## Task 1: New email template `buildWaitlistAssignedEmail`

**Files:**
- Modify: `src/lib/emailService.ts`
- Create: `src/lib/emailService.test.ts`

- [ ] **Step 1: Export `formatDateTimeShort` so cancellation routes can reuse it**

In `src/lib/emailService.ts` find the existing `function formatDateTimeShort(date: Date): string` (around line 854) and add `export` to it:

```ts
export function formatDateTimeShort(date: Date): string {
```

- [ ] **Step 2: Write a failing test for the new template**

Create `src/lib/emailService.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWaitlistAssignedEmail } from './emailService'

describe('buildWaitlistAssignedEmail', () => {
  const baseData = {
    userName: 'María',
    disciplineName: 'Yoga',
    instructorName: 'Valeria Cortez',
    dateTime: 'mié, 7 may 2026, 6:30 p.m.',
    duration: 60,
    packageName: 'Paquete 8 clases',
    classesRemaining: 5,
    profileUrl: 'https://wellneststudio.net/perfil/reservas',
  }

  it('renders the assignment headline', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Se liber')
    expect(html).toContain('un cupo')
  })

  it('greets the user by name when provided', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Hola María')
  })

  it('falls back to plain greeting when name is null', () => {
    const html = buildWaitlistAssignedEmail({ ...baseData, userName: null })
    expect(html).toMatch(/Hola[^<]*<\/p>/)
    expect(html).not.toContain('Hola null')
  })

  it('includes class details', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Yoga')
    expect(html).toContain('Valeria Cortez')
    expect(html).toContain('mié, 7 may 2026, 6:30 p.m.')
    expect(html).toContain('60 minutos')
  })

  it('shows the deducted package and remaining classes', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('Paquete 8 clases')
    expect(html).toContain('5')
  })

  it('includes the CTA button to /perfil/reservas', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('https://wellneststudio.net/perfil/reservas')
    expect(html).toContain('Ver mis reservas')
  })

  it('mentions cancellation policy in the footer', () => {
    const html = buildWaitlistAssignedEmail(baseData)
    expect(html).toContain('4 horas')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/emailService.test.ts`
Expected: FAIL — `buildWaitlistAssignedEmail is not a function` or similar import error.

- [ ] **Step 4: Add the template to `src/lib/emailService.ts`**

Append after `buildReservationConfirmationEmail` (around line 531):

```ts
export interface WaitlistAssignedEmailData {
  userName: string | null
  disciplineName: string
  instructorName: string
  dateTime: string
  duration: number
  packageName: string
  classesRemaining: number
  profileUrl: string
}

export function buildWaitlistAssignedEmail(data: WaitlistAssignedEmailData): string {
  const greeting = data.userName ? `Hola ${data.userName}` : 'Hola'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>&iexcl;Se liber&oacute; un cupo! - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F5F0EB;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #FFFFFF; border-radius: 12px;">
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: #1F2937; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">&iexcl;Se liber&oacute; un cupo!</h1>
              <p style="color: #6B7280; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <p style="color: #374151; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">${greeting}</p>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">
                Estabas en la lista de espera y se liber&oacute; un cupo. Hemos confirmado tu reserva autom&aacute;ticamente y descontado 1 clase de tu paquete.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Clase:</strong> ${data.disciplineName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Instructor:</strong> ${data.instructorName}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Fecha y hora:</strong> ${data.dateTime}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Duraci&oacute;n:</strong> ${data.duration} minutos
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;">
                          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
                            <strong style="color: #374151;">Ubicaci&oacute;n:</strong> Wellnest Studio
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F0F5F1; border: 1px solid #D4E5D7; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                      Se descont&oacute; 1 clase de tu paquete <strong>${data.packageName}</strong>. Te quedan <strong>${data.classesRemaining}</strong> clases disponibles.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #86A889; border-radius: 8px;">
                          <a href="${data.profileUrl}"
                             target="_blank"
                             style="display: inline-block; background-color: #86A889; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Ver mis reservas
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.4;">
                      Si no puedes asistir, recuerda cancelar con al menos <strong>4 horas</strong> de anticipaci&oacute;n desde tu perfil para que la clase regrese a tu paquete.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF;">
                      Wellnest &copy; 2026 &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/emailService.test.ts`
Expected: PASS — all 7 cases.

- [ ] **Step 6: Run the type-checker**

Run: `npx tsc --noEmit`
Expected: no new errors related to emailService.

- [ ] **Step 7: Commit**

```bash
git add src/lib/emailService.ts src/lib/emailService.test.ts
git commit -m "feat(email): add waitlist auto-assignment template"
```

---

## Task 2: Harden `POST /api/waitlist` with full + past validations

**Files:**
- Modify: `src/app/api/waitlist/route.ts:55-141`

- [ ] **Step 1: Update the `findUnique` call to include reservation count**

Find `// Check if class exists` (around line 73) and change the `prisma.class.findUnique` block so it also brings the reservation count:

```ts
const classInfo = await prisma.class.findUnique({
  where: { id: classId },
  include: {
    discipline: true,
    _count: {
      select: { reservations: { where: { status: 'CONFIRMED' } } },
    },
  },
})

if (!classInfo) {
  return NextResponse.json(
    { error: 'Clase no encontrada' },
    { status: 404 }
  )
}

if (new Date(classInfo.dateTime) < new Date()) {
  return NextResponse.json(
    { error: 'No puedes unirte a la lista de espera de una clase que ya pasó.' },
    { status: 400 }
  )
}

if (classInfo._count.reservations < classInfo.maxCapacity) {
  return NextResponse.json(
    { error: 'Esta clase aún tiene cupos disponibles. Reserva directamente.' },
    { status: 400 }
  )
}
```

(The block leading with `// Check if class exists` is replaced by the snippet above. Keep everything below the new validations — the "already on waitlist" check and the position computation — untouched.)

- [ ] **Step 2: Run the type-checker**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Smoke test in dev**

Run: `npm run dev`

In another terminal (or browser dev console while logged in):

```bash
# Try to join waitlist for a class with available spots
curl -X POST http://localhost:3000/api/waitlist \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <copy from devtools>' \
  -d '{"classId":"<id of a class with 0 reservations>"}'
```

Expected response: `{"error":"Esta clase aún tiene cupos disponibles. Reserva directamente."}` with status 400.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/waitlist/route.ts
git commit -m "feat(waitlist): block joining when class has spots or already passed"
```

---

## Task 3: Email after auto-assign in user cancel route

**Files:**
- Modify: `src/app/api/reservations/cancel/route.ts:1-307`

- [ ] **Step 1: Add imports**

At the top of the file, after the existing imports:

```ts
import {
  buildWaitlistAssignedEmail,
  formatDateTimeShort,
  sendEmail,
} from '@/lib/emailService'
```

- [ ] **Step 2: Send email after the waitlist transaction**

Find the existing `console.log('[CANCEL API] Waitlist user auto-assigned:', waitlistAssignment)` (around line 268). Immediately AFTER that line, before the `} catch (waitlistError)` block ends, insert the email send:

```ts
        // Send email notification to the auto-assigned user (non-blocking)
        try {
          const purchaseWithPkg = await prisma.purchase.findUnique({
            where: { id: purchaseToUse.id },
            include: { package: true },
          })

          if (firstInWaitlist.user.email && purchaseWithPkg) {
            await sendEmail({
              to: firstInWaitlist.user.email,
              subject: '¡Se liberó un cupo! Tu reserva está confirmada — Wellnest',
              html: buildWaitlistAssignedEmail({
                userName: firstInWaitlist.user.name,
                disciplineName: reservation.class.discipline.name,
                instructorName: reservation.class.instructor.name,
                dateTime: formatDateTimeShort(reservation.class.dateTime),
                duration: reservation.class.duration,
                packageName: purchaseWithPkg.package.name,
                classesRemaining: purchaseWithPkg.classesRemaining,
                profileUrl: `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/perfil/reservas`,
              }),
            })
            console.log('[CANCEL API] Waitlist email sent to:', firstInWaitlist.user.email)
          }
        } catch (emailErr) {
          console.error('[CANCEL API] Failed to send waitlist email (non-blocking):', emailErr)
        }
```

(This block lives inside the existing `try` that wraps the auto-assign transaction. The existing `} catch (waitlistError)` continues to handle DB errors.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reservations/cancel/route.ts
git commit -m "feat(reservations): email user when auto-assigned from waitlist"
```

---

## Task 4: Auto-assign + email in admin cancel route

**Files:**
- Modify: `src/app/api/admin/attendance/cancel-reservation/route.ts:1-109`

- [ ] **Step 1: Update imports and the reservation include**

Replace the imports block at the top with:

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildWaitlistAssignedEmail,
  formatDateTimeShort,
  sendEmail,
} from '@/lib/emailService'
```

In the `prisma.reservation.findUnique` call (around line 28-39), change the `class` include to also bring the instructor (needed for the email):

```ts
const reservation = await prisma.reservation.findUnique({
  where: { id: reservationId },
  include: {
    user: { select: { id: true, name: true, email: true } },
    purchase: { select: { id: true, classesRemaining: true, status: true } },
    class: {
      include: {
        discipline: { select: { name: true } },
        instructor: { select: { name: true } },
      },
    },
  },
})
```

- [ ] **Step 2: Add auto-assign + email block before the response**

After the existing `console.log` (around line 82-87) and BEFORE the `return NextResponse.json({ success: true ... })` (around line 89), insert:

```ts
    // Auto-assign first user in waitlist (if any) and notify by email
    let waitlistAssignment: { userId: string; userName: string | null; reservationId: string } | null = null
    try {
      const firstInWaitlist = await prisma.waitlist.findFirst({
        where: { classId: reservation.classId },
        orderBy: { position: 'asc' },
        include: {
          user: {
            include: {
              purchases: {
                where: {
                  status: 'ACTIVE',
                  expiresAt: { gt: new Date() },
                  classesRemaining: { gt: 0 },
                },
                orderBy: { expiresAt: 'asc' },
              },
            },
          },
        },
      })

      if (firstInWaitlist && firstInWaitlist.user.purchases.length > 0) {
        const purchaseToUse = firstInWaitlist.user.purchases[0]

        const [newReservation] = await prisma.$transaction([
          prisma.reservation.create({
            data: {
              userId: firstInWaitlist.userId,
              classId: reservation.classId,
              purchaseId: purchaseToUse.id,
              status: 'CONFIRMED',
            },
          }),
          prisma.purchase.update({
            where: { id: purchaseToUse.id },
            data: { classesRemaining: { decrement: 1 } },
          }),
          prisma.waitlist.delete({
            where: { id: firstInWaitlist.id },
          }),
          prisma.waitlist.updateMany({
            where: {
              classId: reservation.classId,
              position: { gt: firstInWaitlist.position },
            },
            data: { position: { decrement: 1 } },
          }),
          // Compensate: admin cancel decremented currentCount above; auto-assign refills the spot
          prisma.class.update({
            where: { id: reservation.classId },
            data: { currentCount: { increment: 1 } },
          }),
        ])

        waitlistAssignment = {
          userId: firstInWaitlist.userId,
          userName: firstInWaitlist.user.name,
          reservationId: newReservation.id,
        }

        console.log('[Admin Cancel] Waitlist user auto-assigned:', waitlistAssignment)

        // Email (non-blocking)
        try {
          const purchaseWithPkg = await prisma.purchase.findUnique({
            where: { id: purchaseToUse.id },
            include: { package: true },
          })

          if (firstInWaitlist.user.email && purchaseWithPkg) {
            await sendEmail({
              to: firstInWaitlist.user.email,
              subject: '¡Se liberó un cupo! Tu reserva está confirmada — Wellnest',
              html: buildWaitlistAssignedEmail({
                userName: firstInWaitlist.user.name,
                disciplineName: reservation.class.discipline.name,
                instructorName: reservation.class.instructor.name,
                dateTime: formatDateTimeShort(reservation.class.dateTime),
                duration: reservation.class.duration,
                packageName: purchaseWithPkg.package.name,
                classesRemaining: purchaseWithPkg.classesRemaining,
                profileUrl: `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/perfil/reservas`,
              }),
            })
            console.log('[Admin Cancel] Waitlist email sent to:', firstInWaitlist.user.email)
          }
        } catch (emailErr) {
          console.error('[Admin Cancel] Failed to send waitlist email (non-blocking):', emailErr)
        }
      }
    } catch (waitlistError) {
      console.error('[Admin Cancel] Failed to auto-assign waitlist user (non-blocking):', waitlistError)
    }
```

- [ ] **Step 3: Include `waitlistAssignment` in the response**

Modify the existing `return NextResponse.json({ success: true, ... })` block to include it:

```ts
return NextResponse.json({
  success: true,
  message: `Reserva cancelada. Se devolvio 1 clase al paquete de ${reservation.user.name || reservation.user.email}.`,
  updatedReservation: {
    id: updatedReservation.id,
    status: updatedReservation.status,
  },
  updatedPurchase: {
    id: updatedPurchase.id,
    classesRemaining: updatedPurchase.classesRemaining,
    status: updatedPurchase.status,
  },
  waitlistAssignment,
})
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/attendance/cancel-reservation/route.ts
git commit -m "feat(admin): auto-assign waitlist + email when admin cancels"
```

---

## Task 5: `/reservar` page — fetch and track waitlist entries

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

- [ ] **Step 1: Add waitlist state at the top of `ReservarPage`**

Find the state declarations near line 254 (`const [reservedClassIds, setReservedClassIds] = ...`). Immediately after, add:

```ts
  const [waitlistEntries, setWaitlistEntries] = React.useState<
    Map<string, { id: string; position: number }>
  >(new Map())
```

- [ ] **Step 2: Add the fetch helper next to `fetchUserReservations`**

After the `fetchUserReservations` definition (ends around line 322), add:

```ts
  const fetchWaitlistEntries = React.useCallback(async () => {
    try {
      const response = await fetch('/api/waitlist')
      if (response.ok) {
        const data = await response.json()
        const map = new Map<string, { id: string; position: number }>()
        for (const item of data.items as Array<{ id: string; classId: string; position: number }>) {
          map.set(item.classId, { id: item.id, position: item.position })
        }
        setWaitlistEntries(map)
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error)
    }
  }, [])
```

- [ ] **Step 3: Wire the fetch into the existing init and visibility effects**

In the mount `useEffect` (around line 325-340), add `fetchWaitlistEntries()` next to `fetchUserReservations()`:

```ts
    fetchDisciplines()
    fetchActivePurchase()
    fetchUserReservations()
    fetchWaitlistEntries()
```

And update the dependency array:

```ts
  }, [fetchActivePurchase, fetchUserReservations, fetchWaitlistEntries])
```

In the `visibilitychange` effect (around line 343-352), do the same:

```ts
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchActivePurchase()
        fetchUserReservations()
        fetchWaitlistEntries()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchActivePurchase, fetchUserReservations, fetchWaitlistEntries])
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/reservar/page.tsx
git commit -m "feat(reservar): fetch user waitlist entries on load"
```

---

## Task 6: `/reservar` page — three visual states for full classes

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

- [ ] **Step 1: Update `MobileDaySection` props to receive waitlist entries**

Find the `MobileDaySection` function signature (around line 93) and add the new prop:

```ts
function MobileDaySection({
  date,
  classes,
  isToday: today,
  weekDays,
  reservedClassIds,
  waitlistEntries,
  activePurchase,
  now,
  onClassClick,
}: {
  date: Date
  classes: ClassData[]
  isToday: boolean
  weekDays: string[]
  reservedClassIds: Set<string>
  waitlistEntries: Map<string, { id: string; position: number }>
  activePurchase: ActivePurchase | null
  now: Date
  onClassClick: (cls: ClassData) => void
}) {
```

- [ ] **Step 2: Update mobile per-class rendering to handle full + on-waitlist states**

In `MobileDaySection`, locate the inner `classes.map((cls) => { ... })` (around line 158). Replace the entire button render with:

```tsx
            classes.map((cls) => {
              const reservationCount = cls._count?.reservations ?? cls.currentCount
              const isFull = reservationCount >= cls.maxCapacity
              const spotsLeft = cls.maxCapacity - reservationCount
              const alreadyReserved = reservedClassIds.has(cls.id)
              const waitlistEntry = waitlistEntries.get(cls.id)
              const isOnWaitlist = !!waitlistEntry
              const isTrialUser = activePurchase?.packageId === TRIAL_PACKAGE_ID
              const isBlockedForTrial = isTrialUser && new Date(cls.dateTime) >= TRIAL_CUTOFF_UTC
              const isPast = new Date(cls.dateTime) < now
              const isDisabled = alreadyReserved || isBlockedForTrial || isPast

              return (
                <button
                  key={cls.id}
                  onClick={() => onClassClick(cls)}
                  disabled={isDisabled}
                  className={cn(
                    'w-full p-4 bg-white rounded-xl border-l-4 shadow-sm text-left transition-all min-h-[88px]',
                    cls.discipline.slug === 'yoga' ? 'border-l-[#9CAF88]' :
                    cls.discipline.slug === 'pilates' ? 'border-l-[#C4A77D]' :
                    cls.discipline.slug === 'pole' ? 'border-l-[#E5E5E5]' :
                    'border-l-primary',
                    isPast
                      ? 'opacity-50 cursor-not-allowed'
                      : isDisabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-md active:scale-[0.98] cursor-pointer'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {cls.discipline.name}
                        {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline.name}`}
                      </span>
                      {cls.classType && (
                        <p className="text-xs text-gray-500 italic">{formatClassType(cls.classType)}</p>
                      )}
                      <div className="flex items-center gap-2 text-foreground">
                        <Clock className="h-4 w-4 flex-shrink-0 text-gray-500" />
                        <span className="text-lg font-semibold">{format(new Date(cls.dateTime), 'HH:mm')}</span>
                        <span className="text-sm text-gray-500">({cls.duration} min)</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm truncate">{cls.instructor.name}</span>
                      </div>
                    </div>
                    <div className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[70px]',
                      isPast ? 'bg-stone-100 text-stone-400' :
                      alreadyReserved ? 'bg-primary/10 text-primary' :
                      isBlockedForTrial ? 'bg-yellow-50 text-yellow-700' :
                      isOnWaitlist ? 'bg-amber-100 text-amber-900' :
                      isFull ? 'bg-amber-50 text-amber-700' :
                      'bg-green-50 text-green-700'
                    )}>
                      {isPast ? (
                        <span className="text-xs font-medium text-center italic">Clase finalizada</span>
                      ) : alreadyReserved ? (
                        <>
                          <Check className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">Reservado</span>
                        </>
                      ) : isBlockedForTrial ? (
                        <span className="text-[10px] font-medium text-center leading-tight">Solo paquete pagado</span>
                      ) : isOnWaitlist ? (
                        <>
                          <Clock className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">En lista #{waitlistEntry.position}</span>
                        </>
                      ) : isFull ? (
                        <>
                          <Users className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">Lleno</span>
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium text-center">{spotsLeft} cupos</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
```

- [ ] **Step 3: Pass waitlistEntries from `ReservarPage` into `MobileDaySection`**

Find where `MobileDaySection` is rendered inside the mobile loop (around line 700-714). Add the new prop:

```tsx
                <MobileDaySection
                  key={index}
                  date={date}
                  classes={dayClasses}
                  isToday={today}
                  weekDays={weekDays}
                  reservedClassIds={reservedClassIds}
                  waitlistEntries={waitlistEntries}
                  activePurchase={activePurchase}
                  now={now}
                  onClassClick={handleSelectClass}
                />
```

- [ ] **Step 4: Update desktop per-class rendering**

Find the desktop grid `dayClasses.map((cls) => { ... })` (around line 760). Replace its full body with:

```tsx
                      dayClasses.map((cls) => {
                        const reservationCount = cls._count?.reservations ?? cls.currentCount
                        const isFull = reservationCount >= cls.maxCapacity
                        const spotsLeft = cls.maxCapacity - reservationCount
                        const alreadyReserved = reservedClassIds.has(cls.id)
                        const waitlistEntry = waitlistEntries.get(cls.id)
                        const isOnWaitlist = !!waitlistEntry
                        const isTrialUser = activePurchase?.packageId === TRIAL_PACKAGE_ID
                        const isBlockedForTrial = isTrialUser && new Date(cls.dateTime) >= TRIAL_CUTOFF_UTC
                        const isPast = new Date(cls.dateTime) < now
                        const isDisabled = alreadyReserved || isBlockedForTrial || isPast

                        return (
                          <button
                            key={cls.id}
                            onClick={() => handleSelectClass(cls)}
                            disabled={isDisabled}
                            title={
                              isPast
                                ? 'Clase finalizada'
                                : isBlockedForTrial
                                  ? 'Tu paquete de prueba solo aplica hasta el 7 de marzo'
                                  : isOnWaitlist
                                    ? `Estás en lista de espera (posición #${waitlistEntry.position})`
                                    : isFull
                                      ? 'Clase llena — toca para unirte a la lista de espera'
                                      : undefined
                            }
                            className={cn(
                              'w-full p-2 rounded-lg text-white text-xs text-left transition-all',
                              disciplineColors[cls.discipline.slug] || 'bg-primary',
                              isPast
                                ? 'opacity-40 cursor-not-allowed'
                                : isDisabled
                                  ? 'opacity-40 cursor-not-allowed'
                                  : isOnWaitlist
                                    ? 'ring-2 ring-amber-400 hover:scale-[1.02] hover:shadow-md cursor-pointer'
                                    : isFull
                                      ? 'opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-md cursor-pointer'
                                      : 'hover:scale-[1.02] hover:shadow-md cursor-pointer'
                            )}
                          >
                            <p className="font-medium">
                              {cls.discipline.name}
                              {cls.complementaryDiscipline && ` + ${cls.complementaryDiscipline.name}`}
                            </p>
                            <p className="flex items-center gap-1 opacity-90">
                              <Clock className="h-3 w-3" />
                              {formatClassTime(cls.dateTime)}
                            </p>
                            <p className="flex items-center gap-1 opacity-90">
                              <User className="h-3 w-3" />
                              {cls.instructor.name.split(' ')[0]}
                            </p>
                            <p className="flex items-center gap-1 mt-1">
                              {isPast ? (
                                <span className="italic">Finalizada</span>
                              ) : alreadyReserved ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Ya reservado
                                </>
                              ) : isBlockedForTrial ? (
                                <span className="text-[10px]">Solo paquete pagado</span>
                              ) : isOnWaitlist ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  En lista #{waitlistEntry.position}
                                </>
                              ) : isFull ? (
                                <>
                                  <Users className="h-3 w-3" />
                                  Lleno · únete
                                </>
                              ) : (
                                <>
                                  <Users className="h-3 w-3" />
                                  {spotsLeft} cupos
                                </>
                              )}
                            </p>
                          </button>
                        )
                      })
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Visual smoke test**

Run: `npm run dev`. Open http://localhost:3000/reservar in the browser. Verify:
- Available classes still show "N cupos" in green.
- Full classes you are NOT on the waitlist for show "Lleno" (mobile: ámbar `bg-amber-50`; desktop: same color tile but with reduced opacity and "Lleno · únete" text).
- The button is now enabled (cursor pointer) but tapping does nothing yet — that comes in Task 7.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/reservar/page.tsx
git commit -m "feat(reservar): show distinct visuals for full and waitlisted classes"
```

---

## Task 7: `/reservar` page — three new modals

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

- [ ] **Step 1: Extend `ModalState` and add waitlist booking state**

Find `type ModalState = 'closed' | 'confirm' | 'success' | 'error'` (around line 81). Replace with:

```ts
type ModalState =
  | 'closed'
  | 'confirm'
  | 'success'
  | 'error'
  | 'waitlist-confirm'
  | 'waitlist-success'
  | 'waitlist-info'
```

In `ReservarPage`, near the existing `isBooking` state (around line 265), add:

```ts
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = React.useState(false)
  const [waitlistMessage, setWaitlistMessage] = React.useState<string | null>(null)
```

- [ ] **Step 2: Update `handleSelectClass` to route by class state**

Find the existing `handleSelectClass` (around line 489) and replace it with:

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

- [ ] **Step 3: Add waitlist action handlers**

Right after `handleConfirmBooking` (around line 574), add two handlers:

```ts
  const handleJoinWaitlist = async () => {
    if (!selectedClass) return
    setIsWaitlistSubmitting(true)
    setWaitlistMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass.id }),
      })
      const data = await response.json()

      if (response.ok) {
        setWaitlistMessage(data.message ?? `Te has unido en posición #${data.entry?.position ?? '?'}.`)
        await fetchWaitlistEntries()
        setModalState('waitlist-success')
      } else {
        setBookingError(data.error || 'Error al unirse a la lista de espera')
        setModalState('error')
      }
    } catch (error) {
      console.error('Error joining waitlist:', error)
      setBookingError('Error de conexión. Por favor intenta de nuevo.')
      setModalState('error')
    } finally {
      setIsWaitlistSubmitting(false)
    }
  }

  const handleLeaveWaitlist = async () => {
    if (!selectedClass) return
    const entry = waitlistEntries.get(selectedClass.id)
    if (!entry) {
      closeModal()
      return
    }

    setIsWaitlistSubmitting(true)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistId: entry.id }),
      })

      if (response.ok) {
        await fetchWaitlistEntries()
        closeModal()
      } else {
        const data = await response.json()
        setBookingError(data.error || 'Error al salir de la lista de espera')
        setModalState('error')
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error)
      setBookingError('Error de conexión. Por favor intenta de nuevo.')
      setModalState('error')
    } finally {
      setIsWaitlistSubmitting(false)
    }
  }
```

- [ ] **Step 4: Reset the new state in `closeModal`**

Find `closeModal` (around line 577) and update it so the timeout also resets the new fields:

```ts
  const closeModal = React.useCallback(() => {
    setModalState('closed')
    setTimeout(() => {
      setSelectedClass(null)
      setBookingError(null)
      setBringGuest(false)
      setGuestEmail('')
      setGuestName('')
      setWaitlistMessage(null)
    }, 150)
  }, [])
```

- [ ] **Step 5: Render the three new modal states**

Inside the `<ModalContent>` block (after the existing `confirm` state JSX, around line 1048 where `</> )}` closes the `confirm` state), insert three new branches BEFORE `</ModalContent>`:

```tsx
          {/* Waitlist confirm */}
          {modalState === 'waitlist-confirm' && selectedClass && (() => {
            const hasNoActivePackage =
              !activePurchase?.hasActivePackage ||
              (activePurchase?.classesRemaining ?? 0) <= 0

            return (
              <>
                <ModalHeader>
                  <ModalTitle>Esta clase está llena</ModalTitle>
                  <ModalDescription>
                    Únete a la lista de espera y te asignaremos automáticamente el primer cupo que se libere.
                  </ModalDescription>
                </ModalHeader>

                <div className="space-y-4">
                  <div
                    className={cn(
                      'p-4 rounded-xl text-white',
                      disciplineColors[selectedClass.discipline.slug] || 'bg-primary'
                    )}
                  >
                    <p className="font-serif text-xl font-semibold">
                      {selectedClass.discipline.name}
                      {selectedClass.complementaryDiscipline && ` + ${selectedClass.complementaryDiscipline.name}`}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fecha</span>
                      <span className="font-medium">{formatClassDate(selectedClass.dateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hora</span>
                      <span className="font-medium">{formatClassTime(selectedClass.dateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Instructor</span>
                      <span className="font-medium">{selectedClass.instructor.name}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                    Te enviaremos un correo electrónico si se libera un cupo y eres asignada.
                  </div>

                  {hasNoActivePackage && (
                    <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg text-sm text-amber-900 space-y-2">
                      <p>
                        <strong>Atención:</strong> Sin un paquete activo con clases disponibles,
                        NO podrás ser asignada cuando se libere un cupo.
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push('/paquetes')}
                        className="underline font-medium"
                      >
                        Comprar un paquete
                      </button>
                    </div>
                  )}
                </div>

                <ModalFooter>
                  <Button variant="ghost" onClick={closeModal} disabled={isWaitlistSubmitting}>
                    Cancelar
                  </Button>
                  <Button onClick={handleJoinWaitlist} isLoading={isWaitlistSubmitting}>
                    Unirme a la lista
                  </Button>
                </ModalFooter>
              </>
            )
          })()}

          {/* Waitlist success */}
          {modalState === 'waitlist-success' && (
            <>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-amber-700" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  ¡En lista de espera!
                </h3>
                <p className="text-gray-600">
                  {waitlistMessage ?? 'Te has unido a la lista de espera.'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Te avisaremos por correo si se libera un cupo.
                </p>
              </div>
              <ModalFooter>
                <Button onClick={closeModal} className="w-full">
                  Entendido
                </Button>
              </ModalFooter>
            </>
          )}

          {/* Waitlist info (already on waitlist) */}
          {modalState === 'waitlist-info' && selectedClass && (() => {
            const entry = waitlistEntries.get(selectedClass.id)
            return (
              <>
                <ModalHeader>
                  <ModalTitle>Estás en la lista de espera</ModalTitle>
                  <ModalDescription>
                    Te asignaremos automáticamente el primer cupo que se libere.
                  </ModalDescription>
                </ModalHeader>

                <div className="space-y-4">
                  <div
                    className={cn(
                      'p-4 rounded-xl text-white',
                      disciplineColors[selectedClass.discipline.slug] || 'bg-primary'
                    )}
                  >
                    <p className="font-serif text-xl font-semibold">
                      {selectedClass.discipline.name}
                      {selectedClass.complementaryDiscipline && ` + ${selectedClass.complementaryDiscipline.name}`}
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Tu posición</p>
                    <p className="text-3xl font-serif font-semibold text-amber-900 mt-1">
                      #{entry?.position ?? '?'}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fecha</span>
                      <span className="font-medium">{formatClassDate(selectedClass.dateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hora</span>
                      <span className="font-medium">{formatClassTime(selectedClass.dateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Instructor</span>
                      <span className="font-medium">{selectedClass.instructor.name}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-beige rounded-lg text-sm text-gray-600">
                    Te enviaremos un correo electrónico si se libera un cupo y eres asignada.
                  </div>
                </div>

                <ModalFooter>
                  <Button variant="ghost" onClick={closeModal} disabled={isWaitlistSubmitting}>
                    Cerrar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleLeaveWaitlist}
                    isLoading={isWaitlistSubmitting}
                    className="text-[var(--color-error)]"
                  >
                    Salir de la lista
                  </Button>
                </ModalFooter>
              </>
            )
          })()}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: End-to-end smoke test**

Run: `npm run dev`. With two test accounts, fill a class with the first account (reserve once with each account), then log in as a third user without any reservation for that class:

- Tap a class with cupos → confirm modal appears (regression check).
- Tap a full class → `waitlist-confirm` modal appears with the class card and the "te enviaremos un correo" note. If the third user has no active package, the amber warning block should appear.
- Confirm join → `waitlist-success` modal with "¡En lista de espera!" + position. After closing, the badge on that class should now read "En lista #N".
- Tap that same class again → `waitlist-info` modal showing position with a "Salir de la lista" button.
- Click "Salir de la lista" → modal closes, badge reverts to "Lleno".

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/reservar/page.tsx
git commit -m "feat(reservar): waitlist join, info, and success modals"
```

---

## Task 8: Update `/perfil/espera` info notice

**Files:**
- Modify: `src/app/(dashboard)/perfil/espera/page.tsx:176-189`

- [ ] **Step 1: Replace the existing info block**

Find the block starting `{/* Info note - Updated for auto-assignment, no notifications */}` (line 176). Replace the entire `<div>` (lines 177-189) with:

```tsx
      {/* Info note */}
      <div className="p-4 bg-white rounded-xl border border-beige text-sm text-gray-600">
        <p>
          <strong>Importante:</strong> Cuando alguien cancela su reserva, el primer lugar
          de la lista de espera es asignado automáticamente si tiene clases disponibles
          en su paquete. Te enviaremos un correo electrónico avisándote cuando esto ocurra.
          El cupo se descontará de tu paquete activo más próximo a vencer.
        </p>
      </div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/perfil/espera/page.tsx
git commit -m "docs(espera): update notice to reflect new email notification"
```

---

## Task 9: End-to-end manual QA + final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

```bash
npx vitest run
```
Expected: all tests pass, including the new `emailService.test.ts`.

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit
```
Expected: zero new errors.

- [ ] **Step 3: Lint**

```bash
npm run lint 2>/dev/null || true
```
Expected: no new warnings introduced by our changes (script may not exist in this repo, ignore if so).

- [ ] **Step 4: End-to-end manual run**

Start: `npm run dev`. With three test accounts (`A`, `B`, `C`), perform the full flow:

  1. Fill a class with `A` and `B`.
  2. Log in as `C` and visit `/reservar`. Find the full class.
     - Mobile: badge should be ámbar "Lleno". Desktop: tile slightly faded with "Lleno · únete" text.
  3. Tap the class. The `waitlist-confirm` modal must open with the class details and the "we'll email you" note.
  4. If `C` has no active package, the amber warning block with the link to `/paquetes` must show.
  5. Tap "Unirme a la lista". Expect `waitlist-success` with "¡En lista de espera! Te has unido en posición #1."
  6. Close the modal. The badge for that class should now read "En lista #1".
  7. Tap the class again. `waitlist-info` modal opens showing position #1.
  8. Visit `/perfil/espera` — the entry should appear, and the new notice text should be visible.
  9. Log in as `A`. From `/perfil/reservas`, cancel the reservation for that class.
  10. Verify in DB / logs that:
      - `A`'s reservation is `CANCELLED`, the package was refunded.
      - `C` now has a `CONFIRMED` reservation for the class.
      - `C`'s waitlist entry was deleted.
      - `C` received the email at the address on file.
  11. Repeat with admin cancel: refill the class, put a fresh user `D` on the waitlist, then have an admin cancel `B`'s reservation from `/admin/asistencias/[classId]`. Same verifications must hold for `D`.
  12. Negative cases:
      - As `C` (already on the waitlist), tap the class — `waitlist-info` opens, NOT another join.
      - From devtools, `POST /api/waitlist` against a class with cupos → 400.
      - From devtools, `POST /api/waitlist` against a past class → 400.

Stop the dev server.

- [ ] **Step 5: Final summary commit (optional housekeeping)**

If any small fixes were needed during QA, group them into a single commit:

```bash
git add -A
git diff --cached --stat   # confirm only intended files
git commit -m "chore(waitlist): post-QA polish"
```

If no further changes were needed, this step is a no-op.

---

## Self-Review Notes

**Spec coverage (cross-checked):**

- §"UI in `/reservar` page" → Tasks 5, 6, 7 ✓
- §"`POST /api/waitlist` — endurecimiento" → Task 2 ✓
- §"new template `buildWaitlistAssignedEmail`" → Task 1 ✓
- §"Disparar email en `/api/reservations/cancel`" → Task 3 ✓
- §"Replicar en `/api/admin/attendance/cancel-reservation`" → Task 4 ✓
- §"Update `/perfil/espera` notice" → Task 8 ✓
- §"Pruebas manuales" → Task 9 ✓

**Type consistency:** `WaitlistAssignedEmailData` is defined in Task 1 and consumed identically in Tasks 3 and 4. `formatDateTimeShort` is exported in Task 1 Step 1 and imported in Tasks 3 and 4. `waitlistEntries` is `Map<string, { id: string; position: number }>` in Task 5 and consumed with that shape in Tasks 6 and 7.

**Placeholders:** none. Every code step has full code; every command has expected output; every commit has the exact message.
