import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'

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

// GET - Fetch classes for the schedule view (grouped by day of week)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {
      isCancelled: false,
    }

    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
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

    // Transform to include day of week info
    const transformedClasses = classes.map((cls) => ({
      id: cls.id,
      disciplineId: cls.disciplineId,
      discipline: cls.discipline.name,
      instructorId: cls.instructorId,
      instructor: cls.instructor.name,
      dateTime: cls.dateTime,
      time: cls.dateTime.toTimeString().slice(0, 5),
      dayOfWeek: cls.dateTime.getDay(),
      duration: cls.duration,
      maxCapacity: cls.maxCapacity,
      currentCount: cls.currentCount,
      reservationsCount: cls._count.reservations,
      isRecurring: cls.isRecurring,
      isCancelled: cls.isCancelled,
    }))

    return NextResponse.json(transformedClasses)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Error al obtener las clases' },
      { status: 500 }
    )
  }
}

// POST - Create a new class (or recurring classes)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
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
          // Only create if date is in the future
          const classDateTime = setMinutes(setHours(currentDate, hours), minutes)
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
    const result = await prisma.class.createMany({
      data: classesToCreate,
    })

    return NextResponse.json({
      message: `Se crearon ${result.count} clase(s) correctamente`,
      count: result.count,
    })
  } catch (error) {
    console.error('Error creating class:', error)
    return NextResponse.json(
      { error: 'Error al crear la clase' },
      { status: 500 }
    )
  }
}
