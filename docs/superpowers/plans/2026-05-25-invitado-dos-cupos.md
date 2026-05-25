# Invitado que ocupa 2 cupos y cuesta 2 clases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que reservar con invitado descuente 2 clases del paquete y ocupe 2 cupos en la clase, con el invitado auto-asignado (sin confirmación ni correo), volviendo al modelo de dos reservas que el esquema ya soporta.

**Architecture:** El esquema permite dos reservas por booking (`@@unique([userId, classId, isGuestReservation])`) y el aforo se calcula contando reservas no canceladas, así que crear una 2ª reserva de invitado hace que el cupo "funcione solo". Una regla pura compartida valida créditos (≥2) y cupos (≥2) en el server y en la UI. La cancelación cancela el par y devuelve 2.

**Tech Stack:** Next.js App Router (route handlers), Prisma, React client component, Vitest (node) para la regla pura.

**Spec:** `docs/superpowers/specs/2026-05-25-invitado-dos-cupos-design.md`

---

## File Structure

- **Create** `src/lib/booking/guestBooking.ts` — regla pura: cuántas clases/cupos cuesta un invitado y si se permite.
- **Create** `src/lib/booking/guestBooking.test.ts` — tests Vitest de la regla.
- **Modify** `src/app/api/reservations/route.ts` — bloque de reserva con invitado (~754-867): validar con la regla, descontar 2, crear 2 reservas, sin correo.
- **Modify** `src/app/api/reservations/cancel/route.ts` — cancelar el par y devolver 2.
- **Modify** `src/app/(dashboard)/reservar/page.tsx` — copy "2 clases", gating del checkbox.
- **Create** `scripts/fix-adriana-guest-reservation.ts` — migración única de la reserva existente.

---

## Task 1: Regla pura de booking con invitado (TDD)

**Files:**
- Create: `src/lib/booking/guestBooking.ts`
- Test: `src/lib/booking/guestBooking.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/booking/guestBooking.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  GUEST_TOTAL_COST,
  GUEST_SEATS,
  checkGuestBookingAllowed,
} from './guestBooking'

describe('guestBooking constants', () => {
  it('a guest booking costs 2 classes and 2 seats', () => {
    expect(GUEST_TOTAL_COST).toBe(2)
    expect(GUEST_SEATS).toBe(2)
  })
})

describe('checkGuestBookingAllowed', () => {
  it('returns OK with enough classes and seats', () => {
    expect(checkGuestBookingAllowed(2, 2)).toBe('OK')
    expect(checkGuestBookingAllowed(80, 10)).toBe('OK')
  })

  it('returns INSUFFICIENT_CREDITS when fewer than 2 classes remain', () => {
    expect(checkGuestBookingAllowed(1, 5)).toBe('INSUFFICIENT_CREDITS')
    expect(checkGuestBookingAllowed(0, 5)).toBe('INSUFFICIENT_CREDITS')
  })

  it('returns INSUFFICIENT_CAPACITY when fewer than 2 seats are free', () => {
    expect(checkGuestBookingAllowed(5, 1)).toBe('INSUFFICIENT_CAPACITY')
    expect(checkGuestBookingAllowed(5, 0)).toBe('INSUFFICIENT_CAPACITY')
  })

  it('checks credits before capacity', () => {
    expect(checkGuestBookingAllowed(1, 0)).toBe('INSUFFICIENT_CREDITS')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test -- src/lib/booking/guestBooking.test.ts`
Expected: FAIL — no se resuelve `./guestBooking`.

- [ ] **Step 3: Implementar**

Crear `src/lib/booking/guestBooking.ts`:

```ts
/**
 * Reglas para reservar llevando un invitado.
 *
 * Un invitado cuesta 2 clases del paquete (1 de la titular + 1 del invitado)
 * y ocupa 2 cupos en la clase (ambos asisten). Fuente única de verdad usada
 * por el POST de reservas y por la UI de /reservar.
 */
export type GuestBookingCheck = 'OK' | 'INSUFFICIENT_CREDITS' | 'INSUFFICIENT_CAPACITY'

/** Clases del paquete consumidas al reservar con invitado. */
export const GUEST_TOTAL_COST = 2
/** Cupos ocupados en la clase al reservar con invitado. */
export const GUEST_SEATS = 2

export function checkGuestBookingAllowed(
  classesRemaining: number,
  spotsAvailable: number
): GuestBookingCheck {
  if (classesRemaining < GUEST_TOTAL_COST) return 'INSUFFICIENT_CREDITS'
  if (spotsAvailable < GUEST_SEATS) return 'INSUFFICIENT_CAPACITY'
  return 'OK'
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test -- src/lib/booking/guestBooking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/guestBooking.ts src/lib/booking/guestBooking.test.ts
git commit -m "feat(booking): regla compartida de reserva con invitado (2 clases / 2 cupos)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Reserva con invitado = 2 reservas, 2 clases, sin correo

**Files:**
- Modify: `src/app/api/reservations/route.ts` (bloque `if (guestData?.email) { … }`, actualmente ~754-867; imports al tope)

Contexto: `ERROR_CODES` (líneas 15-27) incluye `CLASS_FULL` y `NO_PACKAGE`. `classData` se obtiene con `_count: { reservations: { where: { status: { not: 'CANCELLED' } } } }` (línea ~183) y tiene `maxCapacity`. `purchase` tiene `package` y `classesRemaining`.

- [ ] **Step 1: Importar la regla**

Al tope de `src/app/api/reservations/route.ts`, junto a los demás imports, agregar:

```ts
import { checkGuestBookingAllowed, GUEST_TOTAL_COST } from '@/lib/booking/guestBooking'
```

- [ ] **Step 2: Reemplazar el bloque de invitado**

READ primero el bloque actual para confirmar límites exactos: empieza en el comentario `// New model: 1 single reservation with guestEmail, decrement 1 class only.` y termina en el `}` que cierra `if (guestData?.email) {` justo antes del comentario `// === STANDARD (NON-GUEST) RESERVATION ===`.

Reemplazar TODO ese bloque por:

```ts
    // Guest model: two reservations (host + guest), deduct 2 classes, guest auto-accepted.
    // The guest reservation (isGuestReservation=true) occupies a 2nd seat automatically
    // because capacity is counted from non-cancelled reservations.
    if (guestData?.email) {
      // Validate the package supports sharing
      if (!purchase.package.isShareable || purchase.package.maxShares < 1) {
        console.log('[RESERVATIONS API] ERROR: Package does not support sharing')
        return NextResponse.json({
          error: 'Este paquete no permite llevar invitados.',
          code: ERROR_CODES.UNKNOWN_ERROR
        }, { status: 400 })
      }

      const spotsAvailable = classData.maxCapacity - classData._count.reservations
      const guestCheck = checkGuestBookingAllowed(purchase.classesRemaining, spotsAvailable)
      if (guestCheck === 'INSUFFICIENT_CREDITS') {
        console.log('[RESERVATIONS API] ERROR: Not enough classes for guest')
        return NextResponse.json({
          error: 'Necesitas al menos 2 clases en tu paquete para llevar un invitado.',
          code: ERROR_CODES.NO_PACKAGE
        }, { status: 400 })
      }
      if (guestCheck === 'INSUFFICIENT_CAPACITY') {
        console.log('[RESERVATIONS API] ERROR: Not enough seats for guest')
        return NextResponse.json({
          error: 'No hay 2 cupos disponibles para ti y tu invitado en esta clase.',
          code: ERROR_CODES.CLASS_FULL
        }, { status: 400 })
      }

      console.log('[RESERVATIONS API] Creating host + guest reservations (2 classes)...')
      const { reservation, updatedPurchase } = await prisma.$transaction(async (tx) => {
        // Atomic decrement of 2 — guard against race conditions
        const updPurchase = await tx.purchase.update({
          where: { id: purchase.id },
          data: { classesRemaining: { decrement: GUEST_TOTAL_COST } },
        })
        if (updPurchase.classesRemaining < 0) {
          throw new Error('INSUFFICIENT_CREDITS')
        }

        // Host reservation
        const hostRes = await tx.reservation.create({
          data: {
            userId,
            classId,
            purchaseId: purchase.id,
            status: 'CONFIRMED',
            isGuestReservation: false,
          },
          include: {
            class: { include: { discipline: true, instructor: true } },
            purchase: { include: { package: true } },
          },
        })

        // Guest reservation — auto-accepted, occupies a 2nd seat
        await tx.reservation.create({
          data: {
            userId,
            classId,
            purchaseId: purchase.id,
            status: 'CONFIRMED',
            isGuestReservation: true,
            guestEmail: guestData!.email!.trim(),
            guestName: guestData!.name?.trim() || null,
            guestStatus: 'ACCEPTED',
          },
        })

        return { reservation: hostRes, updatedPurchase: updPurchase }
      })

      console.log('[RESERVATIONS API] Host + guest reservations created:', {
        reservationId: reservation.id,
        guestEmail: guestData.email,
        previousRemaining: purchase.classesRemaining,
        newRemaining: updatedPurchase.classesRemaining,
      })

      let finalPurchaseStatus = updatedPurchase.status
      if (updatedPurchase.classesRemaining === 0) {
        const depletedPurchase = await prisma.purchase.update({
          where: { id: purchase.id },
          data: { status: 'DEPLETED' },
        })
        finalPurchaseStatus = depletedPurchase.status
      }

      return NextResponse.json({
        ...reservation,
        updatedPurchase: {
          id: updatedPurchase.id,
          packageName: purchase.package.name,
          classesRemaining: updatedPurchase.classesRemaining,
          status: finalPurchaseStatus,
        }
      }, { status: 201 })
    }
```

Notas:
- Esto elimina el `guestToken` (`crypto.randomBytes`), el `guestStatus: 'PENDING'` y el envío de `buildGuestInvitationEmail`.
- Después de editar, revisar imports ahora sin uso. Si `crypto`, `buildGuestInvitationEmail`, `formatDateTimeFull` (u otros) quedaron sin referencias en el archivo, quitarlos del import. VERIFICAR con grep antes de quitar: `grep -n "crypto\.\|buildGuestInvitationEmail\|formatDateTimeFull" src/app/api/reservations/route.ts`. Quitar del import SOLO los que ya no aparezcan en el cuerpo.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (ignorar los 2 pre-existentes en `scripts/audit-pending-3slot-requests.ts` y `scripts/backfill-private-flow-split.ts`).

Run: `npm run test`
Expected: todo pasa.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reservations/route.ts
git commit -m "feat(reservations): invitado = 2 reservas, 2 clases, auto-aceptado, sin correo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Cancelación cancela el par y devuelve 2

**Files:**
- Modify: `src/app/api/reservations/cancel/route.ts`

Contexto: hoy refunda fijo `classesRefunded = 1` (línea ~138) y cancela solo `reservationId` (transacción línea ~155-180). `reservation` ya viene cargada con `userId`, `classId`, `purchaseId`.

- [ ] **Step 1: Buscar la reserva de invitado asociada y calcular el refund**

READ las líneas ~136-180. Reemplazar la línea:

```ts
    // Always refund 1 class (guest is a free companion, no separate deduction)
    const classesRefunded = 1
```

por:

```ts
    // If this host reservation had a guest (a separate isGuestReservation row for the
    // same user+class), cancel that one too and refund 2. Otherwise refund 1.
    const guestReservation = await prisma.reservation.findFirst({
      where: {
        userId: reservation.userId,
        classId: reservation.classId,
        isGuestReservation: true,
        status: { not: 'CANCELLED' },
      },
    })
    const classesRefunded = guestReservation ? 2 : 1
```

- [ ] **Step 2: Cancelar también la reserva de invitado dentro de la transacción**

Hoy la transacción usa la forma de arreglo `prisma.$transaction([...])`. Para poder cancelar la reserva de invitado de forma condicional SIN perder los tipos de Prisma (y sin usar `any`), cambiar a la forma de callback (la misma que ya usa el POST de reservas).

Reemplazar el bloque:

```ts
    const [updatedReservation, updatedPurchase] = await prisma.$transaction([
      // 1. Mark reservation as cancelled
      prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: {
          class: {
            include: {
              discipline: true,
              instructor: true,
            },
          },
        },
      }),

      // 2. Return classes to the SPECIFIC package that was used
      prisma.purchase.update({
        where: { id: reservation.purchaseId },
        data: {
          classesRemaining: { increment: classesRefunded },
        },
      }),
    ])
```

por:

```ts
    const { updatedReservation, updatedPurchase } = await prisma.$transaction(async (tx) => {
      // 1. Mark host reservation as cancelled
      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: {
          class: {
            include: {
              discipline: true,
              instructor: true,
            },
          },
        },
      })

      // 2. Return classes to the SPECIFIC package that was used
      const updatedPurchase = await tx.purchase.update({
        where: { id: reservation.purchaseId },
        data: {
          classesRemaining: { increment: classesRefunded },
        },
      })

      // 3. If there was a guest reservation, cancel it too
      if (guestReservation) {
        await tx.reservation.update({
          where: { id: guestReservation.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        })
      }

      return { updatedReservation, updatedPurchase }
    })
```

- [ ] **Step 3: Reflejar el refund real en el mensaje de respuesta**

En el `return NextResponse.json({ ... })` final, la línea del mensaje dice:

```ts
      message: `Reserva cancelada correctamente. Se ha devuelto 1 clase a tu paquete "${reservation.purchase.package.name}".`,
```

Reemplazarla por:

```ts
      message: `Reserva cancelada correctamente. Se ${classesRefunded === 1 ? 'ha devuelto 1 clase' : 'han devuelto 2 clases'} a tu paquete "${reservation.purchase.package.name}".`,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

Nota: la forma de callback preserva los tipos de cada `tx.update` automáticamente, así que `updatedReservation` y `updatedPurchase` quedan tipados (se usan después para logging y el response). No usar `any`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reservations/cancel/route.ts
git commit -m "feat(cancel): cancela reserva de invitado y devuelve 2 clases

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: UI de reservar — copy de 2 clases y gating del checkbox

**Files:**
- Modify: `src/app/(dashboard)/reservar/page.tsx`

Contexto: el bloque de invitado se renderiza con `{selectedPurchase?.isShareable && ( … )}`. La nota dice "Se descontará 1 clase de tu paquete. Tu invitado asiste gratis como acompañante." El bloque de descuento (~1157-1196) tiene `const classesToDeduct = 1`. `selectedClass` tiene `maxCapacity` y `_count?.reservations`/`currentCount`. `selectedPurchase?.classesRemaining` existe.

- [ ] **Step 1: Importar la regla compartida**

Cerca de los demás imports de `@/lib/...` en `src/app/(dashboard)/reservar/page.tsx`, agregar:

```ts
import { checkGuestBookingAllowed } from '@/lib/booking/guestBooking'
```

- [ ] **Step 2: Calcular si se puede llevar invitado, dentro del render del modal de confirmación**

READ el bloque del modal `confirm` (donde está `{selectedPurchase?.isShareable && (`). Vamos a envolver ese bloque en un IIFE para tener disponibles `spotsAvailable` y `guestAllowed`.

Reemplazar la apertura del bloque de invitado:

```tsx
                {selectedPurchase?.isShareable && (
```

por una versión que primero calcula la disponibilidad:

```tsx
                {selectedPurchase?.isShareable && (() => {
                  const spotsAvailable =
                    (selectedClass?.maxCapacity ?? 0) -
                    (selectedClass?._count?.reservations ?? selectedClass?.currentCount ?? 0)
                  const guestAllowed =
                    checkGuestBookingAllowed(selectedPurchase?.classesRemaining ?? 0, spotsAvailable) === 'OK'
                  return (
```

y CERRAR ese IIFE: encontrar el cierre actual del bloque de invitado `)}` (el que cierra `{selectedPurchase?.isShareable && (` … `)}`) y reemplazarlo por:

```tsx
                  )
                })()}
```

(Es decir, el contenido interno del bloque de invitado queda igual salvo los cambios de los Steps 3-4; solo lo envolvemos en un IIFE para tener `spotsAvailable`/`guestAllowed`.)

- [ ] **Step 3: Deshabilitar el checkbox cuando no se permite invitado**

Dentro del bloque, el `<input type="checkbox" ...>` del invitado (el que tiene `checked={bringGuest}` y `onChange={(e) => setBringGuest(e.target.checked)}`) cambiarlo por:

```tsx
                      <input
                        type="checkbox"
                        checked={bringGuest && guestAllowed}
                        disabled={!guestAllowed}
                        onChange={(e) => setBringGuest(e.target.checked && guestAllowed)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                      />
```

Y justo debajo del `<label>` del checkbox (después del `</label>` que envuelve el checkbox y el texto "Llevar un invitado a esta clase"), agregar una nota cuando no se permite:

```tsx
                    {!guestAllowed && (
                      <p className="text-xs text-gray-500 pl-7">
                        Para llevar invitado necesitas al menos 2 clases en tu paquete y 2 cupos libres en la clase.
                      </p>
                    )}
```

- [ ] **Step 4: Actualizar la nota de descuento del invitado**

Dentro del bloque que se muestra cuando `bringGuest` está activo, la nota:

```tsx
                        <p className="text-xs text-gray-500">
                          Se descontará 1 clase de tu paquete. Tu invitado asiste gratis como acompañante.
                        </p>
```

reemplazarla por:

```tsx
                        <p className="text-xs text-gray-500">
                          Se descontarán 2 clases de tu paquete (1 tuya + 1 de tu invitado). Tu invitado ocupa un cupo en la clase.
                        </p>
```

- [ ] **Step 5: Actualizar el bloque de "clases a descontar"**

En el bloque IIFE de descuento (~1157-1196), la línea:

```tsx
                  const classesToDeduct = 1 // Always 1 — guest is free companion
```

reemplazarla por:

```tsx
                  const classesToDeduct = bringGuest ? 2 : 1
```

(El resto del bloque ya soporta el texto "descontarán 2 clases" y el cálculo de restantes usa `classesToDeduct`.)

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

Run: `npm run lint`
Expected: sin errores nuevos en `reservar/page.tsx` (si ESLint no está inicializado en el entorno, omitir y confiar en tsc).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/reservar/page.tsx"
git commit -m "feat(reservar): copy de 2 clases y gating del invitado (2 clases / 2 cupos)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrar la reserva existente de Adriana

**Files:**
- Create: `scripts/fix-adriana-guest-reservation.ts`

Datos confirmados: reserva host `cmpkmrk8w00024jk3dvl68h55` (Mat Pilates 25-may), paquete Trimestral `cmpkidha40001tonkgnqyj34l` (estaba en 79), invitado `guestName="Jose"`, `guestEmail="adriana_llopez@hotmail.com"`. Hoy esa reserva host carga los campos de invitado y `guestStatus=PENDING`; el paquete descontó solo 1.

- [ ] **Step 1: Escribir el script idempotente**

Crear `scripts/fix-adriana-guest-reservation.ts`:

```ts
import { prisma } from '../src/lib/prisma'

const HOST_RESERVATION_ID = 'cmpkmrk8w00024jk3dvl68h55'

async function main() {
  const host = await prisma.reservation.findUnique({
    where: { id: HOST_RESERVATION_ID },
  })
  if (!host) {
    console.log('Host reservation not found — nada que migrar.')
    return
  }
  if (host.status === 'CANCELLED') {
    console.log('Host reservation está cancelada — no se migra.')
    return
  }
  if (!host.guestEmail) {
    console.log('La reserva host ya no tiene datos de invitado — probablemente ya migrada.')
    return
  }

  // ¿Ya existe una reserva de invitado para este user+class? (idempotencia)
  const existingGuest = await prisma.reservation.findFirst({
    where: {
      userId: host.userId,
      classId: host.classId,
      isGuestReservation: true,
      status: { not: 'CANCELLED' },
    },
  })
  if (existingGuest) {
    console.log('Ya existe reserva de invitado — no se duplica:', existingGuest.id)
    return
  }

  const guestEmail = host.guestEmail
  const guestName = host.guestName

  await prisma.$transaction(async (tx) => {
    // 1. Crear la reserva del invitado (auto-aceptada)
    await tx.reservation.create({
      data: {
        userId: host.userId,
        classId: host.classId,
        purchaseId: host.purchaseId,
        status: 'CONFIRMED',
        isGuestReservation: true,
        guestEmail,
        guestName,
        guestStatus: 'ACCEPTED',
      },
    })

    // 2. Limpiar los campos de invitado de la reserva host
    await tx.reservation.update({
      where: { id: host.id },
      data: {
        guestEmail: null,
        guestName: null,
        guestStatus: null,
        guestToken: null,
        isGuestReservation: false,
      },
    })

    // 3. Descontar 1 clase más del paquete (la del invitado que no se cobró)
    await tx.purchase.update({
      where: { id: host.purchaseId },
      data: { classesRemaining: { decrement: 1 } },
    })
  })

  const purchase = await prisma.purchase.findUnique({
    where: { id: host.purchaseId },
    select: { classesRemaining: true },
  })
  console.log('Migración OK. Trimestral classesRemaining ahora:', purchase?.classesRemaining)
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Verificar tipos del script**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep fix-adriana || echo "sin errores propios"`
Expected: "sin errores propios" (recordar que `scripts/` está excluido del build; el script igual corre con tsx).

- [ ] **Step 3: Ejecutar la migración (una sola vez)**

Run: `npx tsx scripts/fix-adriana-guest-reservation.ts`
Expected: "Migración OK. Trimestral classesRemaining ahora: 78"

Si imprime que ya estaba migrada / sin datos de invitado, está bien (idempotente).

- [ ] **Step 4: Commit del script**

```bash
git add scripts/fix-adriana-guest-reservation.ts
git commit -m "chore(scripts): migra reserva con invitado de Adriana al modelo de 2 reservas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Verificación end-to-end

**Files:** ninguno (verificación)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build OK (recordar que ya no corre `prisma db push`).

- [ ] **Step 2: Verificar datos de Adriana (read-only)**

Crear `scripts/_tmp_verify_adriana.ts`:

```ts
import { prisma } from '../src/lib/prisma'
async function main() {
  const userId = 'cmm7vd3qr0000frmvfqblzq81'
  const purchase = await prisma.purchase.findFirst({
    where: { userId, package: { name: { contains: 'Trimestral' } }, status: 'ACTIVE' },
    select: { classesRemaining: true },
  })
  console.log('Trimestral classesRemaining:', purchase?.classesRemaining, '(esperado 78)')

  const res = await prisma.reservation.findMany({
    where: { userId, classId: { not: undefined }, guestEmail: { not: null } },
    select: { id: true, isGuestReservation: true, guestStatus: true, guestEmail: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  console.table(res)
}
main().finally(() => prisma.$disconnect())
```

Run: `npx tsx scripts/_tmp_verify_adriana.ts` then `rm scripts/_tmp_verify_adriana.ts`
Expected: Trimestral en **78**; existe una reserva con `isGuestReservation=true`, `guestStatus=ACCEPTED`; la reserva host ya no aparece con `guestEmail`.

- [ ] **Step 3: Verificación manual en la app (dev o prod tras deploy)**

- Reservar con invitado en una clase con ≥2 cupos y paquete con ≥2 clases: descuenta 2; el aforo de la clase baja en 2 (verificar en horarios/reservar que los cupos bajan 2).
- Intentar invitado con paquete de 1 clase o clase con 1 cupo: el checkbox queda deshabilitado con la nota.
- Cancelar una reserva con invitado: devuelve 2 clases y la clase recupera 2 cupos.
- Reservar sin invitado: sigue descontando 1 y 1 cupo.

---

## Self-Review Notes

- **Spec coverage:** validación 2 clases/2 cupos → Tasks 1-2; 2 reservas + auto-accept + sin correo → Task 2; cupo automático → inherente al modelo (Task 2) + verificado en Task 6; cancelación devuelve 2 → Task 3; UI copy + gating → Task 4; corrección de Adriana → Task 5; verificación → Task 6. Fuera de alcance (lista de espera, `/invitacion`) no se toca.
- **Type consistency:** `checkGuestBookingAllowed`, `GUEST_TOTAL_COST`, `GUEST_SEATS` se definen en Task 1 y se usan idénticos en Tasks 2 y 4. `ERROR_CODES.CLASS_FULL`/`NO_PACKAGE`/`UNKNOWN_ERROR` existen en el archivo.
- **No placeholders:** cada paso de código tiene contenido concreto.
