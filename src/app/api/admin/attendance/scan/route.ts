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

    const { qrCode, classId } = await request.json()

    if (!qrCode || !classId) {
      return NextResponse.json({ error: 'QR y clase son requeridos' }, { status: 400 })
    }

    // Find user by QR code
    const user = await prisma.user.findUnique({
      where: { qrCode },
      select: { id: true, name: true, email: true, profileImage: true },
    })

    if (!user) {
      console.log('[ATTENDANCE API] QR not recognized:', qrCode)
      return NextResponse.json({
        error: 'Código QR no reconocido. Este código no pertenece a ningún usuario.',
      }, { status: 404 })
    }

    // Find reservation for this user + class
    const reservation = await prisma.reservation.findFirst({
      where: {
        userId: user.id,
        classId,
        status: { in: ['CONFIRMED', 'ATTENDED'] },
        isGuestReservation: false,
      },
    })

    if (!reservation) {
      console.log('[ATTENDANCE API] No reservation found:', { userId: user.id, classId })
      return NextResponse.json({
        error: `${user.name} no tiene reserva para esta clase.`,
      }, { status: 400 })
    }

    if (reservation.checkedIn) {
      const checkedInTime = reservation.checkedInAt
        ? new Date(reservation.checkedInAt).toLocaleTimeString('es-SV', {
            hour: '2-digit', minute: '2-digit', hour12: true,
          })
        : ''
      return NextResponse.json({
        error: `${user.name} ya hizo check-in${checkedInTime ? ` a las ${checkedInTime}` : ''}.`,
        alreadyCheckedIn: true,
      }, { status: 409 })
    }

    // Check if class already ended
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { dateTime: true, duration: true },
    })

    if (classData) {
      const classEnd = new Date(classData.dateTime.getTime() + classData.duration * 60000)
      if (new Date() > classEnd) {
        return NextResponse.json({
          error: 'Esta clase ya terminó.',
        }, { status: 400 })
      }
    }

    // Mark checked in
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: session.user.id,
        status: 'ATTENDED',
      },
    })

    console.log('[ATTENDANCE API] Check-in successful:', {
      user: user.name,
      reservationId: updated.id,
      classId,
    })

    return NextResponse.json({
      success: true,
      message: 'Check-in exitoso',
      user: { id: user.id, name: user.name, profileImage: user.profileImage },
      reservation: { id: updated.id, checkedInAt: updated.checkedInAt?.toISOString() },
    })
  } catch (error) {
    console.error('[ATTENDANCE API] Scan error:', error)
    return NextResponse.json({ error: 'Error al procesar escaneo' }, { status: 500 })
  }
}
