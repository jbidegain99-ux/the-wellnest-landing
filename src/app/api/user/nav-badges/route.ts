import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic - this route uses headers/session
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    // new Date() para filtros Prisma: getNowInSV devuelve un epoch corrido
    // -6h que NO debe compararse contra timestamps UTC de la BD
    const now = new Date()

    const [activePaquetes, proximasReservas, listaEspera] = await Promise.all([
      // Active purchases: status ACTIVE, not expired, classes remaining
      prisma.purchase.count({
        where: {
          userId,
          status: 'ACTIVE',
          expiresAt: { gt: now },
          classesRemaining: { gt: 0 },
        },
      }),

      // Upcoming reservations: confirmed or pending, class in the future
      prisma.reservation.count({
        where: {
          userId,
          status: 'CONFIRMED',
          class: {
            dateTime: { gt: now },
          },
        },
      }),

      // Waitlist entries for this user
      prisma.waitlist.count({
        where: {
          userId,
        },
      }),
    ])

    return NextResponse.json({
      activePaquetes,
      proximasReservas,
      listaEspera,
    })
  } catch (error) {
    console.error('Error fetching nav badges:', error)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}
