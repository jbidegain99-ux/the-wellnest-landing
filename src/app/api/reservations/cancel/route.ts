import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  console.log('[CANCEL API] Cancel reservation request received')

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[CANCEL API] No authenticated user')
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { reservationId } = body

    console.log('[CANCEL API] Request:', { userId, reservationId })

    if (!reservationId) {
      return NextResponse.json(
        { error: 'ID de reserva requerido' },
        { status: 400 }
      )
    }

    // Find the reservation with class and purchase info
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        class: true,
        purchase: true,
      },
    })

    console.log('[CANCEL API] Reservation found:', reservation ? {
      id: reservation.id,
      userId: reservation.userId,
      status: reservation.status,
      classDateTime: reservation.class.dateTime,
      purchaseId: reservation.purchaseId,
    } : 'Not found')

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (reservation.userId !== userId) {
      console.log('[CANCEL API] User does not own this reservation')
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar esta reserva' },
        { status: 403 }
      )
    }

    // Check if already cancelled
    if (reservation.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Esta reserva ya fue cancelada' },
        { status: 400 }
      )
    }

    // Check if class is in the future (at least 4 hours)
    const classDateTime = new Date(reservation.class.dateTime)
    const now = new Date()
    const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    console.log('[CANCEL API] Hours until class:', hoursUntilClass)

    if (hoursUntilClass < 4) {
      return NextResponse.json(
        { error: 'No puedes cancelar una reserva con menos de 4 horas de anticipación' },
        { status: 400 }
      )
    }

    if (classDateTime <= now) {
      return NextResponse.json(
        { error: 'No puedes cancelar una reserva de una clase que ya pasó' },
        { status: 400 }
      )
    }

    // Perform cancellation in a transaction
    console.log('[CANCEL API] Executing cancellation transaction...')

    const [updatedReservation, updatedPurchase, updatedClass] = await prisma.$transaction([
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

      // 2. Return the class to the package
      prisma.purchase.update({
        where: { id: reservation.purchaseId },
        data: {
          classesRemaining: { increment: 1 },
        },
      }),

      // 3. Decrement class current count
      prisma.class.update({
        where: { id: reservation.classId },
        data: {
          currentCount: { decrement: 1 },
        },
      }),
    ])

    console.log('[CANCEL API] Cancellation successful:', {
      reservationId: updatedReservation.id,
      newStatus: updatedReservation.status,
      purchaseClassesRemaining: updatedPurchase.classesRemaining,
      classCurrentCount: updatedClass.currentCount,
      previousPurchaseStatus: reservation.purchase.status,
    })

    // If purchase was DEPLETED, set it back to ACTIVE since we now have classes
    let finalPurchaseStatus = updatedPurchase.status
    if (reservation.purchase.status === 'DEPLETED' && updatedPurchase.classesRemaining > 0) {
      console.log('[CANCEL API] Reactivating depleted purchase:', reservation.purchaseId)
      const reactivatedPurchase = await prisma.purchase.update({
        where: { id: reservation.purchaseId },
        data: { status: 'ACTIVE' },
      })
      finalPurchaseStatus = reactivatedPurchase.status
      console.log('[CANCEL API] Purchase reactivated to ACTIVE')
    }

    return NextResponse.json({
      success: true,
      message: 'Reserva cancelada correctamente. Se ha devuelto 1 clase a tu paquete.',
      updatedReservation: {
        id: updatedReservation.id,
        status: updatedReservation.status,
        cancelledAt: updatedReservation.cancelledAt,
      },
      updatedPackage: {
        id: updatedPurchase.id,
        classesRemaining: updatedPurchase.classesRemaining,
        status: finalPurchaseStatus,
      },
    })
  } catch (error) {
    console.error('[CANCEL API] Error:', error)
    return NextResponse.json(
      { error: 'Error al cancelar la reserva' },
      { status: 500 }
    )
  }
}
