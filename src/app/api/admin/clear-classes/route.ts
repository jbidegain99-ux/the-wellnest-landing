import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/admin/clear-classes
 * Borra todas las clases del sistema (solo admin)
 * Las reservaciones y waitlist se borran automáticamente por CASCADE
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Contar antes de borrar
    const classCount = await prisma.class.count()
    const reservationCount = await prisma.reservation.count()
    const waitlistCount = await prisma.waitlist.count()

    if (classCount === 0) {
      return NextResponse.json({
        message: 'No hay clases que borrar',
        deleted: { classes: 0, reservations: 0, waitlist: 0 }
      })
    }

    // Borrar en orden correcto por las FK
    const deletedWaitlist = await prisma.waitlist.deleteMany({})
    const deletedReservations = await prisma.reservation.deleteMany({})
    const deletedClasses = await prisma.class.deleteMany({})

    return NextResponse.json({
      message: `Se eliminaron ${deletedClasses.count} clases exitosamente`,
      deleted: {
        classes: deletedClasses.count,
        reservations: deletedReservations.count,
        waitlist: deletedWaitlist.count
      },
      previous: {
        classes: classCount,
        reservations: reservationCount,
        waitlist: waitlistCount
      }
    })
  } catch (error) {
    console.error('Error clearing classes:', error)
    return NextResponse.json(
      { error: 'Error al eliminar las clases' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/clear-classes
 * Muestra cuántas clases hay actualmente (para confirmar antes de borrar)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const classCount = await prisma.class.count()
    const reservationCount = await prisma.reservation.count()
    const waitlistCount = await prisma.waitlist.count()

    return NextResponse.json({
      message: 'Estado actual del sistema',
      counts: {
        classes: classCount,
        reservations: reservationCount,
        waitlist: waitlistCount
      }
    })
  } catch (error) {
    console.error('Error getting counts:', error)
    return NextResponse.json(
      { error: 'Error al obtener el conteo' },
      { status: 500 }
    )
  }
}
