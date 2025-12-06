import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  console.log('[CLASSES API] GET request')

  try {
    const { searchParams } = new URL(request.url)
    const disciplineId = searchParams.get('disciplineId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('[CLASSES API] Query params:', { disciplineId, startDate, endDate })

    const where: any = {
      isCancelled: false,
    }

    if (disciplineId) {
      where.disciplineId = disciplineId
    }

    if (startDate && endDate) {
      // Parse dates properly - ensure we include the full end date
      const start = new Date(startDate)
      const end = new Date(endDate)
      // Set end date to end of day to include all classes on that day
      end.setHours(23, 59, 59, 999)

      where.dateTime = {
        gte: start,
        lte: end,
      }

      console.log('[CLASSES API] Date range:', { start: start.toISOString(), end: end.toISOString() })
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        discipline: true,
        instructor: true,
        // Only count CONFIRMED reservations (not cancelled)
        _count: {
          select: {
            reservations: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    })

    console.log('[CLASSES API] Found classes:', classes.length)

    return NextResponse.json(classes)
  } catch (error) {
    console.error('[CLASSES API] Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Error al obtener las clases' },
      { status: 500 }
    )
  }
}
