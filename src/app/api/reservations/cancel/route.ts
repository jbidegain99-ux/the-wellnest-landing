import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { promoteFromWaitlist } from '@/lib/booking/waitlistPromotion'

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

    // The guest's reservation can't be cancelled on its own — only via the host's.
    if (reservation.isGuestReservation) {
      return NextResponse.json(
        { error: 'No puedes cancelar directamente la reserva del invitado. Cancela tu propia reserva.' },
        { status: 400 }
      )
    }

    // Las sesiones privadas 1:1 tienen su propio flujo (Class +
    // PrivateSessionRequest): cancelarlas por aquí dejaría la sesión y la
    // solicitud desincronizadas. Se coordinan con el estudio.
    if (reservation.class.isPrivate) {
      return NextResponse.json(
        { error: 'Para cancelar o reagendar tu sesión privada, contáctanos por WhatsApp o en recepción.' },
        { status: 400 }
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

    // Perform cancellation in a transaction
    console.log('[CANCEL API] Executing cancellation transaction...')
    console.log('[CANCEL API] Will update:', {
      reservationId: reservationId,
      hasGuest: !!guestReservation,
      classesRefunded,
      purchaseId: reservation.purchaseId,
      packageName: reservation.purchase.package.name,
      currentClassesRemaining: reservation.purchase.classesRemaining,
      afterRefund: reservation.purchase.classesRemaining + classesRefunded,
      classId: reservation.classId,
    })

    // Note: We don't update class.currentCount because we use _count.reservations instead
    // The actual reservation count is calculated from confirmed reservations
    const ALREADY_CANCELLED = 'RESERVATION_ALREADY_CANCELLED'
    const cancelledAt = new Date()
    let txResult: { updatedPurchase: { id: string; classesRemaining: number; status: string }; actualRefunded: number }
    try {
      txResult = await prisma.$transaction(async (tx) => {
        // 1. Atomic claim on the host reservation: only ONE concurrent request
        // can flip it to CANCELLED, so the refund below runs exactly once.
        // (The early status check above is just a fast path.)
        const hostClaim = await tx.reservation.updateMany({
          where: { id: reservationId, status: { not: 'CANCELLED' } },
          data: {
            status: 'CANCELLED',
            cancelledAt,
          },
        })

        if (hostClaim.count === 0) {
          throw new Error(ALREADY_CANCELLED)
        }

        // 2. If there was a guest reservation, cancel it too (conditionally,
        // so a concurrent cancellation can't double-count the guest refund)
        let guestCancelled = 0
        if (guestReservation) {
          const guestClaim = await tx.reservation.updateMany({
            where: { id: guestReservation.id, status: { not: 'CANCELLED' } },
            data: { status: 'CANCELLED', cancelledAt },
          })
          guestCancelled = guestClaim.count
        }

        // 3. Devolver cada reserva a SU propio paquete: tras una transferencia
        // de la reserva del host, el invitado puede seguir colgado de otro
        // purchase — acreditar todo al del host descuadraba ambos paquetes.
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

        // Reactivar cualquiera de los paquetes tocados que estuviera DEPLETED
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
        console.log('[CANCEL API] Lost cancellation race, reservation already cancelled:', reservationId)
        return NextResponse.json(
          { error: 'Esta reserva ya fue cancelada' },
          { status: 400 }
        )
      }
      throw txError
    }
    const { updatedPurchase, actualRefunded } = txResult
    const updatedReservation = {
      id: reservation.id,
      status: 'CANCELLED' as const,
      cancelledAt,
      class: reservation.class,
    }

    console.log('[CANCEL API] Cancellation transaction completed:', {
      reservationId: updatedReservation.id,
      newStatus: updatedReservation.status,
      cancelledAt: updatedReservation.cancelledAt,
      purchaseId: updatedPurchase.id,
      previousClassesRemaining: reservation.purchase.classesRemaining,
      newClassesRemaining: updatedPurchase.classesRemaining,
      previousPurchaseStatus: reservation.purchase.status,
      newPurchaseStatus: updatedPurchase.status,
    })

    // DEPLETED -> ACTIVE reactivation now happens inside the transaction above
    const finalPurchaseStatus = updatedPurchase.status

    // D) AUTO-ASSIGN WAITLIST: promote the first eligible user (shared helper:
    // valida compatibilidad de paquete, trial, capacidad y reactivación)
    let waitlistAssignment = null
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
      console.error('[CANCEL API] Failed to auto-assign waitlist user:', waitlistError)
      // Non-blocking - the cancellation was successful, just couldn't auto-assign
    }

    console.log('[CANCEL API] ========== CANCEL REQUEST SUCCESS ==========')

    return NextResponse.json({
      success: true,
      message: `Reserva cancelada correctamente. Se ${actualRefunded === 1 ? 'ha devuelto 1 clase' : 'han devuelto 2 clases'} a tu paquete "${reservation.purchase.package.name}".`,
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
