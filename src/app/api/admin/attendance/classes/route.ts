import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// El Salvador is UTC-6
const EL_SALVADOR_UTC_OFFSET = 6

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // Calculate day boundaries in UTC for El Salvador's local date
    let dayStartUTC: Date
    if (dateParam) {
      // Parse YYYY-MM-DD as El Salvador local, convert to UTC
      const [year, month, day] = dateParam.split('-').map(Number)
      dayStartUTC = new Date(Date.UTC(year, month - 1, day, EL_SALVADOR_UTC_OFFSET, 0, 0))
    } else {
      // Today in El Salvador
      const nowUTC = new Date()
      const elSalvadorNow = new Date(nowUTC.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
      dayStartUTC = new Date(Date.UTC(
        elSalvadorNow.getUTCFullYear(),
        elSalvadorNow.getUTCMonth(),
        elSalvadorNow.getUTCDate(),
        EL_SALVADOR_UTC_OFFSET, 0, 0
      ))
    }

    const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000)

    const classes = await prisma.class.findMany({
      where: {
        dateTime: { gte: dayStartUTC, lt: dayEndUTC },
        isCancelled: false,
      },
      include: {
        discipline: { select: { id: true, name: true, slug: true } },
        instructor: { select: { id: true, name: true } },
        reservations: {
          where: { status: { in: ['CONFIRMED', 'ATTENDED'] } },
          select: { id: true, checkedIn: true },
        },
      },
      orderBy: { dateTime: 'asc' },
    })

    const result = classes.map((cls) => ({
      id: cls.id,
      dateTime: cls.dateTime.toISOString(),
      duration: cls.duration,
      classType: cls.classType,
      maxCapacity: cls.maxCapacity,
      discipline: cls.discipline,
      instructor: cls.instructor,
      totalReservations: cls.reservations.length,
      checkedInCount: cls.reservations.filter((r) => r.checkedIn).length,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[ATTENDANCE API] Error fetching classes:', error)
    return NextResponse.json({ error: 'Error al obtener clases' }, { status: 500 })
  }
}
