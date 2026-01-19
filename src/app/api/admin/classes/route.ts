import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { addDays, startOfDay } from 'date-fns'

// El Salvador is UTC-6. To store times that display correctly for El Salvador users,
// we need to add 6 hours to the desired local time to get UTC.
const EL_SALVADOR_UTC_OFFSET = 6

const classSchema = z.object({
  disciplineId: z.string().min(1, 'Debe seleccionar una disciplina'),
  instructorId: z.string().min(1, 'Debe seleccionar un instructor'),
  dayOfWeek: z.number().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  duration: z.number().min(15, 'La duración mínima es 15 minutos'),
  maxCapacity: z.number().min(1, 'La capacidad mínima es 1'),
  isRecurring: z.boolean().default(true),
  weeksAhead: z.number().min(1).max(12).default(4), // How many weeks to create classes for
})

// Helper to convert UTC date to El Salvador local time string (HH:MM)
function getElSalvadorTime(utcDate: Date): string {
  // El Salvador is UTC-6, so subtract 6 hours from UTC
  const elSalvadorDate = new Date(utcDate.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  const hours = elSalvadorDate.getUTCHours().toString().padStart(2, '0')
  const minutes = elSalvadorDate.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// Helper to get day of week in El Salvador timezone
function getElSalvadorDayOfWeek(utcDate: Date): number {
  const elSalvadorDate = new Date(utcDate.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  return elSalvadorDate.getUTCDay()
}

// GET - Fetch classes for the schedule view (grouped by day of week)
export async function GET(request: Request) {
  console.log('[ADMIN CLASSES API] ========== GET REQUEST ==========')

  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    console.log('[ADMIN CLASSES API] Query params:', { startDate, endDate })

    const where: Record<string, unknown> = {
      isCancelled: false,
    }

    if (startDate && endDate) {
      // Parse dates for El Salvador timezone (UTC-6)
      // The frontend sends dates in YYYY-MM-DD format representing El Salvador dates
      const startParts = startDate.split('-').map(Number)
      const endParts = endDate.split('-').map(Number)

      // Convert El Salvador dates to UTC range:
      // El Salvador midnight = UTC + 6 hours
      const start = new Date(Date.UTC(
        startParts[0],
        startParts[1] - 1,
        startParts[2],
        EL_SALVADOR_UTC_OFFSET, // 6 AM UTC = midnight El Salvador
        0, 0, 0
      ))
      const end = new Date(Date.UTC(
        endParts[0],
        endParts[1] - 1,
        endParts[2] + 1, // Next day
        EL_SALVADOR_UTC_OFFSET - 1, // 5 AM UTC = 11 PM El Salvador previous day
        59, 59, 999
      ))

      where.dateTime = {
        gte: start,
        lte: end,
      }
      console.log('[ADMIN CLASSES API] Date filter (El Salvador -> UTC):', {
        startInput: startDate,
        endInput: endDate,
        startUTC: start.toISOString(),
        endUTC: end.toISOString(),
      })
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        discipline: true,
        instructor: true,
        _count: {
          select: { reservations: true },
        },
      },
      orderBy: { dateTime: 'asc' },
    })

    console.log('[ADMIN CLASSES API] Found classes:', classes.length)

    // Transform to include day of week info (using El Salvador timezone)
    const transformedClasses = classes.map((cls) => ({
      id: cls.id,
      disciplineId: cls.disciplineId,
      discipline: cls.discipline.name,
      instructorId: cls.instructorId,
      instructor: cls.instructor.name,
      dateTime: cls.dateTime.toISOString(),
      time: getElSalvadorTime(cls.dateTime),
      dayOfWeek: getElSalvadorDayOfWeek(cls.dateTime),
      duration: cls.duration,
      maxCapacity: cls.maxCapacity,
      currentCount: cls.currentCount,
      reservationsCount: cls._count.reservations,
      isRecurring: cls.isRecurring,
      isCancelled: cls.isCancelled,
    }))

    if (classes.length > 0) {
      console.log('[ADMIN CLASSES API] Sample class:', {
        id: transformedClasses[0].id,
        discipline: transformedClasses[0].discipline,
        dateTimeUTC: transformedClasses[0].dateTime,
        timeElSalvador: transformedClasses[0].time,
      })
    }

    return NextResponse.json(transformedClasses)
  } catch (error) {
    console.error('[ADMIN CLASSES API] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener las clases' },
      { status: 500 }
    )
  }
}

// POST - Create a new class (or recurring classes)
export async function POST(request: Request) {
  console.log('[ADMIN CLASSES API] ========== POST REQUEST ==========')

  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[ADMIN CLASSES API] Request body:', body)

    const validation = classSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verify discipline exists
    const discipline = await prisma.discipline.findUnique({
      where: { id: data.disciplineId },
    })
    if (!discipline) {
      return NextResponse.json(
        { error: 'La disciplina no existe' },
        { status: 400 }
      )
    }

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
    })
    if (!instructor) {
      return NextResponse.json(
        { error: 'El instructor no existe' },
        { status: 400 }
      )
    }

    // Parse time
    const [hours, minutes] = data.time.split(':').map(Number)

    // Create classes for the specified number of weeks
    const classesToCreate: Array<{
      disciplineId: string
      instructorId: string
      dateTime: Date
      duration: number
      maxCapacity: number
      isRecurring: boolean
    }> = []

    const today = startOfDay(new Date())
    const weeksAhead = data.isRecurring ? data.weeksAhead : 1

    // Find the next occurrence of the selected day of week
    for (let week = 0; week < weeksAhead; week++) {
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = addDays(today, week * 7 + dayOffset)
        if (currentDate.getDay() === data.dayOfWeek) {
          // Create date in UTC that represents the correct El Salvador local time
          // e.g., 10:00 AM El Salvador = 16:00 UTC (10:00 + 6 hours offset)
          const classDateTime = new Date(Date.UTC(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            hours + EL_SALVADOR_UTC_OFFSET,
            minutes
          ))

          // Only create if date is in the future
          if (classDateTime > new Date()) {
            classesToCreate.push({
              disciplineId: data.disciplineId,
              instructorId: data.instructorId,
              dateTime: classDateTime,
              duration: data.duration,
              maxCapacity: data.maxCapacity,
              isRecurring: data.isRecurring,
            })
          }
          break // Found the day for this week, move to next week
        }
      }
    }

    if (classesToCreate.length === 0) {
      return NextResponse.json(
        { error: 'No se pudieron crear clases. Verifica la fecha seleccionada.' },
        { status: 400 }
      )
    }

    // Create all classes
    console.log('[ADMIN CLASSES API] Creating classes:', classesToCreate.length)
    if (classesToCreate.length > 0) {
      console.log('[ADMIN CLASSES API] First class to create:', {
        ...classesToCreate[0],
        dateTimeISO: classesToCreate[0].dateTime.toISOString(),
        dateTimeElSalvador: getElSalvadorTime(classesToCreate[0].dateTime),
      })
    }

    const result = await prisma.class.createMany({
      data: classesToCreate,
    })

    console.log('[ADMIN CLASSES API] Classes created successfully:', result.count)

    return NextResponse.json({
      message: `Se crearon ${result.count} clase(s) correctamente`,
      count: result.count,
    })
  } catch (error) {
    console.error('[ADMIN CLASSES API] Error creating class:', error)
    return NextResponse.json(
      { error: 'Error al crear la clase. Por favor intenta de nuevo.' },
      { status: 500 }
    )
  }
}
