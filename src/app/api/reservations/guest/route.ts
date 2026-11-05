import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import {
  ADD_GUEST_MESSAGES,
  AddGuestFailure,
  addGuestToReservationInTx,
  checkAddGuestEligibility,
} from '@/lib/booking/addGuest'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reservationId: z.string().min(1),
  guest: z.object({
    email: z.string().trim().email(),
    name: z.string().trim().max(100).optional(),
  }),
})

/**
 * POST /api/reservations/guest
 * Agrega un invitado a una reserva propia ya confirmada ("Mis Reservas").
 * Cuesta 1 clase del mismo paquete de la reserva y ocupa 1 cupo.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribe un correo válido para tu invitado.' }, { status: 400 })
  }
  const { reservationId, guest } = parsed.data
  const guestName = guest.name || null

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        class: { select: { id: true, dateTime: true, isCancelled: true, isPrivate: true, maxCapacity: true } },
        purchase: { include: { package: { select: { isShareable: true, maxShares: true } } } },
      },
    })

    const ineligible = checkAddGuestEligibility(
      reservation,
      session.user.id,
      session.user.email,
      guest.email,
      new Date()
    )
    if (ineligible || !reservation) {
      const reason = ineligible ?? 'NOT_FOUND'
      return NextResponse.json(
        { error: ADD_GUEST_MESSAGES[reason], code: reason },
        { status: reason === 'NOT_FOUND' ? 404 : 400 }
      )
    }

    const result = await prisma.$transaction(
      (tx) =>
        addGuestToReservationInTx(tx, {
          hostReservationId: reservation.id,
          userId: reservation.userId,
          classId: reservation.class.id,
          maxCapacity: reservation.class.maxCapacity,
          purchaseId: reservation.purchaseId,
          guestEmail: guest.email,
          guestName,
        }),
      { maxWait: 5000, timeout: 10000 }
    )

    console.log('[ADD GUEST] Guest added', {
      reservationId: reservation.id,
      guestReservationId: result.guestReservationId,
      classesRemaining: result.classesRemaining,
    })

    return NextResponse.json({ success: true, classesRemaining: result.classesRemaining }, { status: 201 })
  } catch (error) {
    if (error instanceof AddGuestFailure) {
      return NextResponse.json({ error: ADD_GUEST_MESSAGES[error.reason], code: error.reason }, { status: 400 })
    }
    const prismaCode = (error as { code?: string } | null)?.code
    if (prismaCode === 'P2028') {
      return NextResponse.json(
        { error: 'Hay mucha demanda en esta clase en este momento. Intenta de nuevo en unos segundos.' },
        { status: 409 }
      )
    }
    if (prismaCode === 'P2002') {
      return NextResponse.json({ error: ADD_GUEST_MESSAGES.GUEST_ALREADY_ACTIVE }, { status: 400 })
    }
    console.error('[ADD GUEST] Error:', error)
    return NextResponse.json(
      { error: 'No pudimos agregar a tu invitado. Intenta de nuevo; no se descontaron clases.' },
      { status: 500 }
    )
  }
}
