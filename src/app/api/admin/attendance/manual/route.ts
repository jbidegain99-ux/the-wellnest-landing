import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { reservationId } = await request.json()

    if (!reservationId) {
      return NextResponse.json({ error: 'ID de reserva requerido' }, { status: 400 })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    // Toggle: if already checked in, undo; otherwise check in
    if (reservation.checkedIn) {
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          checkedIn: false,
          checkedInAt: null,
          checkedInBy: null,
          status: 'CONFIRMED',
        },
      })

      console.log('[ATTENDANCE API] Manual undo check-in:', {
        user: reservation.user.name,
        reservationId: updated.id,
      })

      return NextResponse.json({
        success: true,
        message: `Check-in de ${reservation.user.name} revertido`,
        checkedIn: false,
      })
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: session.user.id,
        status: 'ATTENDED',
      },
    })

    console.log('[ATTENDANCE API] Manual check-in:', {
      user: reservation.user.name,
      reservationId: updated.id,
    })

    return NextResponse.json({
      success: true,
      message: `${reservation.user.name} marcado como presente`,
      checkedIn: true,
      checkedInAt: updated.checkedInAt?.toISOString(),
    })
  } catch (error) {
    console.error('[ATTENDANCE API] Manual check-in error:', error)
    return NextResponse.json({ error: 'Error al procesar check-in' }, { status: 500 })
  }
}
