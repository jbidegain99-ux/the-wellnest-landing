import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildWaitlistAssignedEmail,
  formatDateTimeShort,
  sendEmail,
} from '@/lib/emailService'

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
  } catch (error) {
    console.error('Error cancelling reservation:', error)
    return NextResponse.json(
      { error: 'Error al cancelar la reserva' },
      { status: 500 }
    )
  }
}
