import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  console.log('[CLASSES API] ========== GET REQUEST ==========')
  console.log('[CLASSES API] Timestamp:', new Date().toISOString())

  try {
    const { searchParams } = new URL(request.url)
    const disciplineId = searchParams.get('disciplineId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('[CLASSES API] Query params:', {
      disciplineId: disciplineId || 'all',
      startDate: startDate || 'not specified',
      endDate: endDate || 'not specified'
    })

    const where: any = {
      isCancelled: false,
    }

    if (disciplineId) {
      where.disciplineId = disciplineId
    }

    if (startDate && endDate) {
      // Parse dates properly - use UTC to avoid timezone issues
      // The frontend sends dates in YYYY-MM-DD format
      const startParts = startDate.split('-').map(Number)
      const endParts = endDate.split('-').map(Number)

      // Create dates at the start of the day (local time)
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0, 0)
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59, 999)

      where.dateTime = {
        gte: start,
        lte: end,
      }

      console.log('[CLASSES API] Date range (local):', {
        startInput: startDate,
        endInput: endDate,
        startParsed: start.toISOString(),
        endParsed: end.toISOString(),
        startLocal: start.toLocaleString('es-SV'),
        endLocal: end.toLocaleString('es-SV'),
      })
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

    if (classes.length > 0) {
      console.log('[CLASSES API] First class:', {
        id: classes[0].id,
        discipline: classes[0].discipline.name,
        dateTime: classes[0].dateTime,
      })
      console.log('[CLASSES API] Last class:', {
        id: classes[classes.length - 1].id,
        discipline: classes[classes.length - 1].discipline.name,
        dateTime: classes[classes.length - 1].dateTime,
      })
    } else if (startDate && endDate) {
      // If no classes found, let's check what's in the database
      const totalClasses = await prisma.class.count({
        where: { isCancelled: false }
      })
      const futureClasses = await prisma.class.count({
        where: {
          isCancelled: false,
          dateTime: { gte: new Date() }
        }
      })

      // Get the date range of available classes
      const dateRange = await prisma.class.aggregate({
        where: { isCancelled: false },
        _min: { dateTime: true },
        _max: { dateTime: true },
      })

      console.log('[CLASSES API] No classes found for date range. Database status:', {
        totalClasses,
        futureClasses,
        earliestClass: dateRange._min.dateTime,
        latestClass: dateRange._max.dateTime,
        requestedStart: startDate,
        requestedEnd: endDate,
      })
    }

    return NextResponse.json(classes)
  } catch (error) {
    console.error('[CLASSES API] ========== ERROR ==========')
    console.error('[CLASSES API] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener las clases' },
      { status: 500 }
    )
  }
}
