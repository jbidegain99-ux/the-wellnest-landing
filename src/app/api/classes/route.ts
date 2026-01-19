import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Force dynamic - this route uses request.url and DB queries
export const dynamic = 'force-dynamic'

// El Salvador is UTC-6. When the frontend sends "2025-01-20", it means
// "all classes on January 20 in El Salvador time".
// El Salvador Jan 20 00:00 = UTC Jan 20 06:00
// El Salvador Jan 20 23:59 = UTC Jan 21 05:59
const EL_SALVADOR_UTC_OFFSET_HOURS = 6

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
      // Parse dates for El Salvador timezone (UTC-6)
      // The frontend sends dates in YYYY-MM-DD format representing El Salvador dates
      const startParts = startDate.split('-').map(Number)
      const endParts = endDate.split('-').map(Number)

      // Convert El Salvador dates to UTC range:
      // El Salvador midnight = UTC + 6 hours
      // e.g., El Salvador Jan 20 00:00 = UTC Jan 20 06:00
      // e.g., El Salvador Jan 25 23:59 = UTC Jan 26 05:59
      const start = new Date(Date.UTC(
        startParts[0],
        startParts[1] - 1,
        startParts[2],
        EL_SALVADOR_UTC_OFFSET_HOURS, // 6 AM UTC = midnight El Salvador
        0, 0, 0
      ))
      const end = new Date(Date.UTC(
        endParts[0],
        endParts[1] - 1,
        endParts[2] + 1, // Next day
        EL_SALVADOR_UTC_OFFSET_HOURS - 1, // 5 AM UTC = 11 PM El Salvador previous day
        59, 59, 999
      ))

      where.dateTime = {
        gte: start,
        lte: end,
      }

      console.log('[CLASSES API] Date range (El Salvador -> UTC):', {
        startInput: startDate,
        endInput: endDate,
        startUTC: start.toISOString(),
        endUTC: end.toISOString(),
        explanation: `El Salvador ${startDate} 00:00 to ${endDate} 23:59`,
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
