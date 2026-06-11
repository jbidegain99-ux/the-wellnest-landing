/**
 * Promoción automática desde la lista de espera cuando se libera un cupo.
 *
 * Compartida por el cancel de usuario y el cancel de admin para que las
 * validaciones no puedan divergir entre rutas:
 *   - No promueve si la clase ya empezó.
 *   - Solo usa paquetes compatibles con la clase (no privados, disciplina
 *     cubierta, no trial bloqueado por fecha) — igual que el auto-select de
 *     POST /api/reservations.
 *   - Itera la cola: si el primero no tiene paquete elegible, intenta con el
 *     siguiente (antes la cola entera quedaba bloqueada en silencio).
 *   - Si el usuario promovido tenía una reserva cancelada en esa clase, la
 *     reactiva (antes el create chocaba con P2002 y fallaba en silencio).
 *   - Re-verifica capacidad bajo lock dentro de la transacción.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isTrialBlockedForClass } from '@/lib/booking/trialCutoff'
import {
  buildWaitlistAssignedEmail,
  formatDateTimeShort,
  sendEmail,
} from '@/lib/emailService'

export interface WaitlistPromotionClassInfo {
  classId: string
  classDateTime: Date
  disciplineId: string
  disciplineName: string
  instructorName: string
  duration: number
  maxCapacity: number
}

export interface WaitlistPromotionResult {
  userId: string
  userName: string | null
  reservationId: string
}

async function assertCapacityInsideTx(
  tx: Prisma.TransactionClient,
  classId: string,
  maxCapacity: number
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Class" WHERE id = ${classId} FOR UPDATE`
  const activeCount = await tx.reservation.count({
    where: { classId, status: { not: 'CANCELLED' } },
  })
  if (activeCount + 1 > maxCapacity) {
    throw new Error('CLASS_FULL_RACE')
  }
}

export async function promoteFromWaitlist(
  classInfo: WaitlistPromotionClassInfo
): Promise<WaitlistPromotionResult | null> {
  const { classId, classDateTime, disciplineId } = classInfo
  const now = new Date()

  // Una clase que ya empezó o terminó no debe consumir créditos de nadie
  if (classDateTime <= now) {
    console.log('[WAITLIST] Class already started/finished, skipping promotion:', classId)
    return null
  }

  const queue = await prisma.waitlist.findMany({
    where: { classId },
    orderBy: { position: 'asc' },
    include: {
      user: {
        include: {
          purchases: {
            where: {
              status: 'ACTIVE',
              expiresAt: { gt: now },
              classesRemaining: { gt: 0 },
              // Mismos filtros de compatibilidad que el auto-select de reservas
              package: {
                isPrivate: false,
                OR: [
                  { disciplines: { none: {} } },
                  { disciplines: { some: { disciplineId } } },
                ],
              },
            },
            orderBy: { expiresAt: 'asc' },
          },
        },
      },
    },
  })

  for (const entry of queue) {
    const eligiblePurchase = entry.user.purchases.find(
      (p) => !isTrialBlockedForClass(p.packageId, classDateTime)
    )
    if (!eligiblePurchase) {
      console.log('[WAITLIST] No eligible purchase for waitlist user, trying next:', entry.userId)
      continue
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        await assertCapacityInsideTx(tx, classId, classInfo.maxCapacity)

        const updPurchase = await tx.purchase.update({
          where: { id: eligiblePurchase.id },
          data: { classesRemaining: { decrement: 1 } },
        })
        if (updPurchase.classesRemaining < 0) {
          throw new Error('INSUFFICIENT_CREDITS')
        }

        // Si el usuario ya tuvo una reserva personal en esta clase, hay un
        // unique constraint: reactivar la cancelada en vez de crear otra.
        const existing = await tx.reservation.findFirst({
          where: { userId: entry.userId, classId, isGuestReservation: false },
        })

        let reservationId: string
        if (existing) {
          if (existing.status !== 'CANCELLED') {
            // Ya tiene reserva activa — solo sacarlo de la cola, sin consumir
            throw new Error('ALREADY_RESERVED_SKIP')
          }
          const reactivated = await tx.reservation.update({
            where: { id: existing.id },
            data: { status: 'CONFIRMED', purchaseId: eligiblePurchase.id, cancelledAt: null },
          })
          reservationId = reactivated.id
        } else {
          const created = await tx.reservation.create({
            data: {
              userId: entry.userId,
              classId,
              purchaseId: eligiblePurchase.id,
              status: 'CONFIRMED',
            },
          })
          reservationId = created.id
        }

        if (updPurchase.classesRemaining === 0) {
          await tx.purchase.update({
            where: { id: eligiblePurchase.id },
            data: { status: 'DEPLETED' },
          })
        }

        await tx.waitlist.delete({ where: { id: entry.id } })
        await tx.waitlist.updateMany({
          where: { classId, position: { gt: entry.position } },
          data: { position: { decrement: 1 } },
        })

        return { reservationId, classesRemaining: updPurchase.classesRemaining }
      })

      console.log('[WAITLIST] User auto-assigned from waitlist:', {
        userId: entry.userId,
        userName: entry.user.name,
        reservationId: result.reservationId,
      })

      // Email de confirmación (best-effort, no bloquea la promoción)
      if (entry.user.email) {
        try {
          const purchaseWithPkg = await prisma.purchase.findUnique({
            where: { id: eligiblePurchase.id },
            include: { package: true },
          })
          if (purchaseWithPkg) {
            await sendEmail({
              to: entry.user.email,
              subject: '¡Se liberó un cupo! Tu reserva está confirmada — Wellnest',
              html: buildWaitlistAssignedEmail({
                userName: entry.user.name,
                disciplineName: classInfo.disciplineName,
                instructorName: classInfo.instructorName,
                dateTime: formatDateTimeShort(classDateTime),
                duration: classInfo.duration,
                packageName: purchaseWithPkg.package.name,
                classesRemaining: purchaseWithPkg.classesRemaining,
                profileUrl: `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/perfil/reservas`,
              }),
            })
            console.log('[WAITLIST] Assignment email sent to:', entry.user.email)
          }
        } catch (emailErr) {
          console.error('[WAITLIST] Failed to send assignment email (non-blocking):', emailErr)
        }
      }

      return {
        userId: entry.userId,
        userName: entry.user.name,
        reservationId: result.reservationId,
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_RESERVED_SKIP') {
        // Tiene reserva activa: limpiar su entrada de la cola y seguir
        console.log('[WAITLIST] User already has an active reservation, removing from queue:', entry.userId)
        await prisma.waitlist
          .delete({ where: { id: entry.id } })
          .catch(() => { /* ya borrada por otra promoción concurrente */ })
        continue
      }
      if (err instanceof Error && err.message === 'CLASS_FULL_RACE') {
        // El cupo liberado ya fue tomado por una reserva directa — no hay nada que promover
        console.log('[WAITLIST] Freed spot was taken concurrently, stopping promotion:', classId)
        return null
      }
      console.error('[WAITLIST] Failed to promote waitlist user, trying next:', {
        userId: entry.userId,
        error: err instanceof Error ? err.message : err,
      })
      continue
    }
  }

  return null
}
