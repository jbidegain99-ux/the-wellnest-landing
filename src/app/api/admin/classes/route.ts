import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { svLocalToUTC } from '@/lib/utils/timezone'
import { MAX_DATES_PER_BATCH, formatDateShort, getTodaySV } from '@/lib/schedule/classDates'

// El Salvador is UTC-6. To store times that display correctly for El Salvador users,
// we need to add 6 hours to the desired local time to get UTC.
const EL_SALVADOR_UTC_OFFSET = 6

const classSchema = z.object({
  disciplineId: z.string().min(1, 'Debe seleccionar una disciplina'),
  complementaryDisciplineId: z.string().nullable().optional(),
  instructorId: z.string().min(1, 'Debe seleccionar un instructor'),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'))
    .min(1, 'Debe seleccionar al menos una fecha')
    .max(MAX_DATES_PER_BATCH, `No se pueden crear más de ${MAX_DATES_PER_BATCH} clases a la vez`),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  duration: z.number().min(15, 'La duración mínima es 15 minutos'),
  maxCapacity: z.number().min(1, 'La capacidad mínima es 1'),
  classType: z.string().nullable().optional(),
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
      // Frontend sends ISO strings (e.g., "2025-01-19T06:00:00.000Z")
      // Use new Date() which handles ISO strings correctly
      const start = new Date(startDate)
      const end = new Date(endDate)

      where.dateTime = {
        gte: start,
        lte: end,
      }
      console.log('[ADMIN CLASSES API] Date filter:', {
        startInput: startDate,
        endInput: endDate,
        startParsed: start.toISOString(),
        endParsed: end.toISOString(),
      })
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        discipline: true,
        complementaryDiscipline: true,
        instructor: true,
        _count: {
          select: {
            reservations: {
              where: { status: { not: 'CANCELLED' } },
            },
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    })

    console.log('[ADMIN CLASSES API] Found classes:', classes.length)

    // DESGLOSE POR DISCIPLINA para debug
    const classesByDiscipline: Record<string, number> = {}
    classes.forEach((cls) => {
      const key = `${cls.discipline.name} (${cls.discipline.slug})`
      classesByDiscipline[key] = (classesByDiscipline[key] || 0) + 1
    })
    console.log('[ADMIN CLASSES API] Desglose por disciplina:', classesByDiscipline)

    // Transform to include day of week info (using El Salvador timezone)
    const transformedClasses = classes.map((cls) => ({
      id: cls.id,
      disciplineId: cls.disciplineId,
      discipline: cls.discipline.name,
      complementaryDisciplineId: cls.complementaryDisciplineId,
      complementaryDiscipline: cls.complementaryDiscipline?.name || null,
      instructorId: cls.instructorId,
      instructor: cls.instructor.name,
      dateTime: cls.dateTime.toISOString(),
      time: getElSalvadorTime(cls.dateTime),
      dayOfWeek: getElSalvadorDayOfWeek(cls.dateTime),
      duration: cls.duration,
      maxCapacity: cls.maxCapacity,
      currentCount: cls.currentCount,
      classType: cls.classType,
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

    console.log('[ADMIN CLASSES API] Validated data:', {
      disciplineId: data.disciplineId,
      instructorId: data.instructorId,
      dates: data.dates,
      time: data.time,
    })

    // Verify discipline exists
    const discipline = await prisma.discipline.findUnique({
      where: { id: data.disciplineId },
    })
    console.log('[ADMIN CLASSES API] Discipline lookup result:', discipline ? {
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug,
      isActive: discipline.isActive,
    } : 'NOT FOUND')

    if (!discipline) {
      // List all available disciplines for debugging
      const allDisciplines = await prisma.discipline.findMany({
        select: { id: true, name: true, slug: true, isActive: true },
      })
      console.log('[ADMIN CLASSES API] Available disciplines in DB:', allDisciplines)
      return NextResponse.json(
        { error: `La disciplina no existe. ID recibido: ${data.disciplineId}` },
        { status: 400 }
      )
    }

    // Verify instructor exists
    const instructor = await prisma.instructor.findUnique({
      where: { id: data.instructorId },
    })
    console.log('[ADMIN CLASSES API] Instructor lookup result:', instructor ? {
      id: instructor.id,
      name: instructor.name,
      isActive: instructor.isActive,
    } : 'NOT FOUND')

    if (!instructor) {
      // List all available instructors for debugging
      const allInstructors = await prisma.instructor.findMany({
        select: { id: true, name: true, isActive: true },
      })
      console.log('[ADMIN CLASSES API] Available instructors in DB:', allInstructors)
      return NextResponse.json(
        { error: `El instructor no existe. ID recibido: ${data.instructorId}` },
        { status: 400 }
      )
    }

    // Parse time
    const [hours, minutes] = data.time.split(':').map(Number)

    // Verify complementary discipline exists if provided
    if (data.complementaryDisciplineId) {
      const compDiscipline = await prisma.discipline.findUnique({
        where: { id: data.complementaryDisciplineId },
      })
      if (!compDiscipline) {
        return NextResponse.json(
          { error: 'La disciplina complementaria no existe' },
          { status: 400 }
        )
      }
      if (data.complementaryDisciplineId === data.disciplineId) {
        return NextResponse.json(
          { error: 'La disciplina complementaria debe ser diferente a la principal' },
          { status: 400 }
        )
      }
    }

    // Dedupe y orden cronológico: la UI ya lo hace, pero la API no confía en eso.
    const requestedDates = Array.from(new Set(data.dates)).sort()
    const todaySV = getTodaySV()
    const now = new Date()

    const skipped: Array<{ date: string; label: string; reason: string }> = []
    const candidates: Array<{ date: string; dateTime: Date }> = []

    for (const date of requestedDates) {
      if (date < todaySV) {
        skipped.push({ date, label: formatDateShort(date), reason: 'La fecha ya pasó' })
        continue
      }

      const [year, month, day] = date.split('-').map(Number)
      const classDateTime = svLocalToUTC(year, month - 1, day, hours, minutes)

      // Hoy mismo a una hora que ya pasó: la clase nacería vencida.
      if (classDateTime <= now) {
        skipped.push({ date, label: formatDateShort(date), reason: 'La hora ya pasó' })
        continue
      }

      candidates.push({ date, dateTime: classDateTime })
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'Ninguna de las fechas seleccionadas es válida. Todas ya pasaron.' },
        { status: 400 }
      )
    }

    // Choques de horario del mismo instructor: una sola consulta para todo el rango.
    const rangeStart = candidates[0].dateTime
    const rangeEnd = candidates[candidates.length - 1].dateTime
    const existingClasses = await prisma.class.findMany({
      where: {
        instructorId: data.instructorId,
        isCancelled: false,
        dateTime: {
          gte: new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { dateTime: true, duration: true },
    })

    const newStartMs = (dt: Date) => dt.getTime()
    const overlaps = (startA: number, durA: number, startB: number, durB: number) =>
      startA < startB + durB * 60000 && startB < startA + durA * 60000

    const classesToCreate: Array<{
      disciplineId: string
      complementaryDisciplineId: string | null
      instructorId: string
      dateTime: Date
      duration: number
      maxCapacity: number
      classType: string | null
      isRecurring: boolean
    }> = []

    // Las clases del propio lote también pueden chocar entre sí (misma hora, misma fecha).
    const acceptedSlots: Array<{ start: number; duration: number }> = existingClasses.map((c) => ({
      start: c.dateTime.getTime(),
      duration: c.duration,
    }))

    for (const candidate of candidates) {
      const start = newStartMs(candidate.dateTime)
      const hasConflict = acceptedSlots.some((slot) =>
        overlaps(start, data.duration, slot.start, slot.duration)
      )

      if (hasConflict) {
        skipped.push({
          date: candidate.date,
          label: formatDateShort(candidate.date),
          reason: 'El instructor ya tiene una clase a esa hora',
        })
        continue
      }

      acceptedSlots.push({ start, duration: data.duration })
      classesToCreate.push({
        disciplineId: data.disciplineId,
        complementaryDisciplineId: data.complementaryDisciplineId || null,
        instructorId: data.instructorId,
        dateTime: candidate.dateTime,
        duration: data.duration,
        maxCapacity: data.maxCapacity,
        classType: data.classType || null,
        // La recurrencia ahora se expresa eligiendo fechas, no con una bandera.
        isRecurring: false,
      })
    }

    if (classesToCreate.length === 0) {
      return NextResponse.json(
        {
          error: 'No se creó ninguna clase.',
          skipped,
        },
        { status: 400 }
      )
    }

    console.log('[ADMIN CLASSES API] Creating classes:', classesToCreate.length)

    const result = await prisma.class.createMany({
      data: classesToCreate,
    })

    console.log('[ADMIN CLASSES API] Classes created successfully:', result.count, 'skipped:', skipped.length)

    const message =
      skipped.length > 0
        ? `Se ${result.count === 1 ? 'creó' : 'crearon'} ${result.count} clase(s). ${skipped.length} fecha(s) se omitieron.`
        : `Se ${result.count === 1 ? 'creó' : 'crearon'} ${result.count} clase(s) correctamente`

    return NextResponse.json({
      message,
      count: result.count,
      created: result.count,
      skipped,
    })
  } catch (error) {
    console.error('[ADMIN CLASSES API] Error creating class:', error)
    return NextResponse.json(
      { error: 'Error al crear la clase. Por favor intenta de nuevo.' },
      { status: 500 }
    )
  }
}
