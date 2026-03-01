import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: Fetch invitation details (public — no auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const reservation = await prisma.reservation.findFirst({
      where: { guestToken: token },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
          },
        },
        user: {
          select: { name: true },
        },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    const classDateTime = new Date(reservation.class.dateTime)
    const isPast = classDateTime < new Date()

    return NextResponse.json({
      id: reservation.id,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail,
      guestStatus: reservation.guestStatus,
      hostName: reservation.user.name,
      status: reservation.status,
      isPast,
      class: {
        disciplineName: reservation.class.discipline.name,
        instructorName: reservation.class.instructor.name,
        dateTime: reservation.class.dateTime,
        duration: reservation.class.duration,
      },
    })
  } catch (error) {
    console.error('[INVITATIONS API] Error fetching invitation:', error)
    return NextResponse.json({ error: 'Error al obtener la invitación' }, { status: 500 })
  }
}

// POST: Accept or decline invitation (public — no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const body = await request.json()
    const { action } = body as { action: 'accept' | 'decline' }

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const reservation = await prisma.reservation.findFirst({
      where: { guestToken: token },
      include: {
        class: { include: { discipline: true } },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    if (reservation.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Esta reserva fue cancelada por el anfitrión' }, { status: 400 })
    }

    const classDateTime = new Date(reservation.class.dateTime)
    if (classDateTime < new Date()) {
      return NextResponse.json({ error: 'Esta clase ya pasó' }, { status: 400 })
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED'

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { guestStatus: newStatus },
    })

    console.log('[INVITATIONS API] Guest invitation updated:', {
      reservationId: reservation.id,
      guestEmail: reservation.guestEmail,
      action,
      newStatus,
    })

    return NextResponse.json({
      success: true,
      guestStatus: newStatus,
      message: action === 'accept'
        ? '¡Invitación aceptada! Te esperamos en la clase.'
        : 'Invitación declinada.',
    })
  } catch (error) {
    console.error('[INVITATIONS API] Error updating invitation:', error)
    return NextResponse.json({ error: 'Error al procesar la invitación' }, { status: 500 })
  }
}
