import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Execute cancellation + refund in a transaction
    const [updatedReservation, updatedPurchase] = await prisma.$transaction([
      // 1. Cancel the reservation
      prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: null,
        },
      }),

      // 2. Refund 1 class to the purchase
      prisma.purchase.update({
        where: { id: reservation.purchaseId },
        data: {
          classesRemaining: { increment: 1 },
          // Reactivate if it was depleted
          ...(reservation.purchase.status === 'DEPLETED' ? { status: 'ACTIVE' } : {}),
        },
      }),
    ])

    // Decrement class currentCount if tracked
    await prisma.class.update({
      where: { id: reservation.classId },
      data: { currentCount: { decrement: 1 } },
    }).catch(() => {
      // Non-critical — currentCount may already be 0
    })

    console.log(
      `[Admin Cancel] Admin ${session.user.email} cancelled reservation ${reservationId} ` +
      `for user ${reservation.user.email} in class ${reservation.class.discipline.name}. ` +
      `Refunded 1 class to purchase ${reservation.purchaseId}. ` +
      `New balance: ${updatedPurchase.classesRemaining}`
    )

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
    })
  } catch (error) {
    console.error('Error cancelling reservation:', error)
    return NextResponse.json(
      { error: 'Error al cancelar la reserva' },
      { status: 500 }
    )
  }
}
