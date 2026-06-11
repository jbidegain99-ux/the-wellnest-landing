import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { promoteFromWaitlist } from '@/lib/booking/waitlistPromotion'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/attendance/cancel-reservation
 * Admin cancels a reservation from the attendance list and refunds the class credit.
 * Unlike the user-facing cancel, this has NO time restriction (admin can cancel anytime).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { reservationId } = await request.json()

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId es requerido' }, { status: 400 })
    }

    // Find the reservation with its purchase
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

    if (!reservation) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    if (reservation.status === 'CANCELLED') {
      return NextResponse.json({ error: 'La reserva ya fue cancelada' }, { status: 400 })
    }

    // Si se cancela la reserva del HOST y tiene un invitado vivo en la misma
    // clase, el invitado también se cancela y se reembolsan 2 (mismo
    // comportamiento que el cancel del usuario).
    const guestReservation = reservation.isGuestReservation
      ? null
      : await prisma.reservation.findFirst({
          where: {
            userId: reservation.userId,
            classId: reservation.classId,
            isGuestReservation: true,
            status: { not: 'CANCELLED' },
          },
        })

    // Execute cancellation + refund in a transaction
    const ALREADY_CANCELLED = 'RESERVATION_ALREADY_CANCELLED'
    let txResult: {
      updatedPurchase: { id: string; classesRemaining: number; status: string }
      actualRefunded: number
    }
    try {
      txResult = await prisma.$transaction(async (tx) => {
        // 1. Atomic claim: only one concurrent cancellation (admin or user)
        // can flip the reservation, so the refund runs exactly once.
        const claim = await tx.reservation.updateMany({
          where: { id: reservationId, status: { not: 'CANCELLED' } },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            checkedIn: false,
            checkedInAt: null,
            checkedInBy: null,
          },
        })

        if (claim.count === 0) {
          throw new Error(ALREADY_CANCELLED)
        }

        // 2. Cancel the sibling guest reservation too (conditionally)
        let guestCancelled = 0
        if (guestReservation) {
          const guestClaim = await tx.reservation.updateMany({
            where: { id: guestReservation.id, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          })
          guestCancelled = guestClaim.count
        }

        // 3. Devolver cada reserva a SU propio paquete (tras una transferencia
        // el invitado puede colgar de otro purchase)
        await tx.purchase.update({
          where: { id: reservation.purchaseId },
          data: { classesRemaining: { increment: 1 } },
        })
        if (guestCancelled > 0 && guestReservation) {
          await tx.purchase.update({
            where: { id: guestReservation.purchaseId },
            data: { classesRemaining: { increment: 1 } },
          })
        }
        const touchedPurchaseIds = Array.from(
          new Set([reservation.purchaseId, ...(guestCancelled > 0 && guestReservation ? [guestReservation.purchaseId] : [])])
        )
        await tx.purchase.updateMany({
          where: { id: { in: touchedPurchaseIds }, status: 'DEPLETED', classesRemaining: { gt: 0 } },
          data: { status: 'ACTIVE' },
        })

        const actualRefunded = 1 + guestCancelled
        const updatedPurchase = await tx.purchase.findUniqueOrThrow({
          where: { id: reservation.purchaseId },
        })

        return { updatedPurchase, actualRefunded }
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === ALREADY_CANCELLED) {
        return NextResponse.json({ error: 'La reserva ya fue cancelada' }, { status: 400 })
      }
      throw txError
    }
    const { updatedPurchase, actualRefunded } = txResult
    const updatedReservation = { id: reservationId, status: 'CANCELLED' as const }

    // (currentCount ya no se mantiene: la ocupación se deriva siempre de
    // _count.reservations — el contador manual llevaba años descuadrado)

    console.log(
      `[Admin Cancel] Admin ${session.user.email} cancelled reservation ${reservationId} ` +
      `for user ${reservation.user.email} in class ${reservation.class.discipline.name}. ` +
      `Refunded ${actualRefunded} class(es) to purchase ${reservation.purchaseId}. ` +
      `New balance: ${updatedPurchase.classesRemaining}`
    )

    // Auto-assign from waitlist via shared helper. It refuses to promote when
    // the class already started (admin can cancel past reservations) and
    // validates package compatibility/trial/capacity like a normal booking.
    let waitlistAssignment: { userId: string; userName: string | null; reservationId: string } | null = null
    try {
      waitlistAssignment = await promoteFromWaitlist({
        classId: reservation.classId,
        classDateTime: new Date(reservation.class.dateTime),
        disciplineId: reservation.class.disciplineId,
        disciplineName: reservation.class.discipline.name,
        instructorName: reservation.class.instructor.name,
        duration: reservation.class.duration,
        maxCapacity: reservation.class.maxCapacity,
      })
    } catch (waitlistError) {
      console.error('[Admin Cancel] Failed to auto-assign waitlist user (non-blocking):', waitlistError)
    }

    return NextResponse.json({
      success: true,
      message: `Reserva cancelada. Se ${actualRefunded === 1 ? 'devolvió 1 clase' : `devolvieron ${actualRefunded} clases`} al paquete de ${reservation.user.name || reservation.user.email}.`,
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
  } catch (error) {
    console.error('Error cancelling reservation:', error)
    return NextResponse.json(
      { error: 'Error al cancelar la reserva' },
      { status: 500 }
    )
  }
}
