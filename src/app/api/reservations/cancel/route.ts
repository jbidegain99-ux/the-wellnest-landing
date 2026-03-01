import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  console.log('[CANCEL API] ========== CANCEL REQUEST START ==========')
  console.log('[CANCEL API] Timestamp:', new Date().toISOString())

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[CANCEL API] ERROR: No authenticated user')
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { reservationId } = body

    console.log('[CANCEL API] Request details:', {
      userId,
      userEmail: session.user.email,
      reservationId
    })

    if (!reservationId) {
      console.log('[CANCEL API] ERROR: No reservationId provided')
      return NextResponse.json(
        { error: 'ID de reserva requerido' },
        { status: 400 }
      )
    }

    // Find the reservation with class and purchase info
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
          }
        },
        purchase: {
          include: {
            package: true,
          }
        },
      },
    })

    if (reservation) {
      console.log('[CANCEL API] Reservation found:', {
        id: reservation.id,
        userId: reservation.userId,
        status: reservation.status,
        classId: reservation.classId,
        className: reservation.class.discipline.name,
        classDateTime: reservation.class.dateTime,
        purchaseId: reservation.purchaseId,
        packageName: reservation.purchase.package.name,
        packageClassesRemaining: reservation.purchase.classesRemaining,
        packageStatus: reservation.purchase.status,
      })
    } else {
      console.log('[CANCEL API] ERROR: Reservation not found:', reservationId)
    }

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reserva no encontrada. Es posible que ya haya sido cancelada.' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (reservation.userId !== userId) {
      console.log('[CANCEL API] ERROR: User does not own this reservation', {
        reservationUserId: reservation.userId,
        requestUserId: userId
      })
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar esta reserva' },
        { status: 403 }
      )
    }

    // Check if already cancelled
    if (reservation.status === 'CANCELLED') {
      console.log('[CANCEL API] ERROR: Reservation already cancelled')
      return NextResponse.json(
        { error: 'Esta reserva ya fue cancelada' },
        { status: 400 }
      )
    }

    // Check if class is in the future (at least 4 hours)
    const classDateTime = new Date(reservation.class.dateTime)
    const now = new Date()
    const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    console.log('[CANCEL API] Time validation:', {
      classDateTime: classDateTime.toISOString(),
      classLocalTime: classDateTime.toLocaleString('es-SV'),
      currentTime: now.toISOString(),
      hoursUntilClass: hoursUntilClass.toFixed(2),
      minimumHours: 4,
      canCancel: hoursUntilClass >= 4,
    })

    if (classDateTime <= now) {
      console.log('[CANCEL API] ERROR: Class already happened')
      return NextResponse.json(
        { error: 'No puedes cancelar una reserva de una clase que ya pasó' },
        { status: 400 }
      )
    }

    if (hoursUntilClass < 4) {
      console.log('[CANCEL API] ERROR: Too close to class time')
      return NextResponse.json(
        { error: `No puedes cancelar una reserva con menos de 4 horas de anticipación. La clase es en ${hoursUntilClass.toFixed(1)} horas.` },
        { status: 400 }
      )
    }

    // Check if this reservation has a linked guest reservation
    const linkedGuestReservation = !reservation.isGuestReservation
      ? await prisma.reservation.findFirst({
          where: {
            userId: reservation.userId,
            classId: reservation.classId,
            isGuestReservation: true,
            status: 'CONFIRMED',
          },
        })
      : null

    const classesRefunded = linkedGuestReservation ? 2 : 1

    // Perform cancellation in a transaction
    console.log('[CANCEL API] Executing cancellation transaction...')
    console.log('[CANCEL API] Will update:', {
      reservationId: reservationId,
      hasLinkedGuest: !!linkedGuestReservation,
      classesRefunded,
      purchaseId: reservation.purchaseId,
      packageName: reservation.purchase.package.name,
      currentClassesRemaining: reservation.purchase.classesRemaining,
      afterRefund: reservation.purchase.classesRemaining + classesRefunded,
      classId: reservation.classId,
    })

    // Cancel the guest reservation first if it exists
    if (linkedGuestReservation) {
      await prisma.reservation.update({
        where: { id: linkedGuestReservation.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })
      console.log('[CANCEL API] Guest reservation cancelled:', linkedGuestReservation.id)
    }

    // Note: We don't update class.currentCount because we use _count.reservations instead
    // The actual reservation count is calculated from confirmed reservations
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

    console.log('[CANCEL API] Cancellation transaction completed:', {
      reservationId: updatedReservation.id,
      newStatus: updatedReservation.status,
      cancelledAt: updatedReservation.cancelledAt,
      guestCancelled: !!linkedGuestReservation,
      purchaseId: updatedPurchase.id,
      previousClassesRemaining: reservation.purchase.classesRemaining,
      newClassesRemaining: updatedPurchase.classesRemaining,
      previousPurchaseStatus: reservation.purchase.status,
      newPurchaseStatus: updatedPurchase.status,
    })

    // If purchase was DEPLETED, set it back to ACTIVE since we now have classes
    let finalPurchaseStatus = updatedPurchase.status
    if (reservation.purchase.status === 'DEPLETED' && updatedPurchase.classesRemaining > 0) {
      console.log('[CANCEL API] Reactivating depleted purchase:', {
        purchaseId: reservation.purchaseId,
        packageName: reservation.purchase.package.name,
        classesNow: updatedPurchase.classesRemaining,
      })
      const reactivatedPurchase = await prisma.purchase.update({
        where: { id: reservation.purchaseId },
        data: { status: 'ACTIVE' },
      })
      finalPurchaseStatus = reactivatedPurchase.status
      console.log('[CANCEL API] Purchase reactivated from DEPLETED to ACTIVE')
    }

    // D) AUTO-ASSIGN WAITLIST: Check if someone is on the waitlist for this class
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

    let waitlistAssignment = null
    if (firstInWaitlist && firstInWaitlist.user.purchases.length > 0) {
      console.log('[CANCEL API] Found user in waitlist:', {
        userId: firstInWaitlist.userId,
        userName: firstInWaitlist.user.name,
        position: firstInWaitlist.position,
      })

      const purchaseToUse = firstInWaitlist.user.purchases[0]

      try {
        // Create reservation for waitlist user and remove from waitlist
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
          // Reorder remaining waitlist positions
          prisma.waitlist.updateMany({
            where: {
              classId: reservation.classId,
              position: { gt: firstInWaitlist.position },
            },
            data: { position: { decrement: 1 } },
          }),
        ])

        waitlistAssignment = {
          userId: firstInWaitlist.userId,
          userName: firstInWaitlist.user.name,
          reservationId: newReservation.id,
        }

        console.log('[CANCEL API] Waitlist user auto-assigned:', waitlistAssignment)
      } catch (waitlistError) {
        console.error('[CANCEL API] Failed to auto-assign waitlist user:', waitlistError)
        // Non-blocking - the cancellation was successful, just couldn't auto-assign
      }
    }

    console.log('[CANCEL API] ========== CANCEL REQUEST SUCCESS ==========')

    return NextResponse.json({
      success: true,
      message: linkedGuestReservation
        ? `Reserva cancelada correctamente (incluyendo invitado). Se han devuelto ${classesRefunded} clases a tu paquete "${reservation.purchase.package.name}".`
        : `Reserva cancelada correctamente. Se ha devuelto 1 clase a tu paquete "${reservation.purchase.package.name}".`,
      updatedReservation: {
        id: updatedReservation.id,
        status: updatedReservation.status,
        cancelledAt: updatedReservation.cancelledAt,
        class: {
          id: updatedReservation.class.id,
          discipline: updatedReservation.class.discipline.name,
          dateTime: updatedReservation.class.dateTime,
        }
      },
      updatedPackage: {
        id: updatedPurchase.id,
        packageName: reservation.purchase.package.name,
        classesRemaining: updatedPurchase.classesRemaining,
        status: finalPurchaseStatus,
      },
    })
  } catch (error: any) {
    console.error('[CANCEL API] ========== ERROR ==========')
    console.error('[CANCEL API] Error type:', error?.constructor?.name)
    console.error('[CANCEL API] Error message:', error?.message)
    console.error('[CANCEL API] Full error:', error)
    return NextResponse.json(
      { error: 'Error al cancelar la reserva. Por favor intenta de nuevo.' },
      { status: 500 }
    )
  }
}
