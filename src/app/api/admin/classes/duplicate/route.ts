import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { svLocalToUTC } from '@/lib/utils/timezone'

const duplicateClassSchema = z.object({
  sourceClassId: z.string().min(1),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  targetTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  instructorId: z.string().min(1),
  disciplineId: z.string().min(1),
  complementaryDisciplineId: z.string().nullable(),
  duration: z.number().min(15),
  maxCapacity: z.number().min(1),
  classType: z.string().nullable(),
})

const requestSchema = z.object({
  classes: z.array(duplicateClassSchema).min(1).max(50),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { classes } = validation.data

    // Batch-verify all referenced IDs exist
    const instructorIds = Array.from(new Set(classes.map(c => c.instructorId)))
    const disciplineIds = Array.from(new Set([
      ...classes.map(c => c.disciplineId),
      ...classes.filter(c => c.complementaryDisciplineId).map(c => c.complementaryDisciplineId!),
    ]))

    const [instructors, disciplines] = await Promise.all([
      prisma.instructor.findMany({ where: { id: { in: instructorIds } }, select: { id: true } }),
      prisma.discipline.findMany({ where: { id: { in: disciplineIds } }, select: { id: true } }),
    ])

    const validInstructorIds = new Set(instructors.map(i => i.id))
    const validDisciplineIds = new Set(disciplines.map(d => d.id))

    const summary: Array<{
      sourceClassId: string
      targetDate: string
      targetTime: string
      status: 'created' | 'failed'
      error?: string
    }> = []

    let created = 0
    let failed = 0

    for (const entry of classes) {
      // Validate IDs
      if (!validInstructorIds.has(entry.instructorId)) {
        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'failed', error: 'Instructor no encontrado' })
        failed++
        continue
      }
      if (!validDisciplineIds.has(entry.disciplineId)) {
        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'failed', error: 'Disciplina no encontrada' })
        failed++
        continue
      }
      if (entry.complementaryDisciplineId && !validDisciplineIds.has(entry.complementaryDisciplineId)) {
        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'failed', error: 'Disciplina complementaria no encontrada' })
        failed++
        continue
      }

      // Check for conflicts: same instructor, same date, overlapping time
      const [year, month, day] = entry.targetDate.split('-').map(Number)
      const [hours, minutes] = entry.targetTime.split(':').map(Number)

      // Get start/end of target day in UTC (for SV day boundaries)
      const dayStartUTC = svLocalToUTC(year, month - 1, day, 0, 0)
      const dayEndUTC = svLocalToUTC(year, month - 1, day, 23, 59, 59)

      const existingClasses = await prisma.class.findMany({
        where: {
          instructorId: entry.instructorId,
          isCancelled: false,
          dateTime: {
            gte: dayStartUTC,
            lte: dayEndUTC,
          },
        },
        select: { dateTime: true, duration: true },
      })

      // Check time overlap in JS
      const newStartMin = hours * 60 + minutes
      const newEndMin = newStartMin + entry.duration
      let hasConflict = false

      for (const existing of existingClasses) {
        // Convert existing class time to SV local minutes
        const svTime = new Date(existing.dateTime.getTime() - 6 * 60 * 60 * 1000)
        const existStartMin = svTime.getUTCHours() * 60 + svTime.getUTCMinutes()
        const existEndMin = existStartMin + existing.duration

        if (newStartMin < existEndMin && existStartMin < newEndMin) {
          hasConflict = true
          break
        }
      }

      if (hasConflict) {
        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'failed', error: 'Conflicto de horario con clase existente del instructor' })
        failed++
        continue
      }

      // Create the class
      try {
        const classDateTime = svLocalToUTC(year, month - 1, day, hours, minutes)

        await prisma.class.create({
          data: {
            disciplineId: entry.disciplineId,
            complementaryDisciplineId: entry.complementaryDisciplineId,
            instructorId: entry.instructorId,
            dateTime: classDateTime,
            duration: entry.duration,
            maxCapacity: entry.maxCapacity,
            classType: entry.classType,
            isRecurring: false,
          },
        })

        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'created' })
        created++
      } catch (err) {
        console.error('[DUPLICATE API] Error creating class:', err)
        summary.push({ sourceClassId: entry.sourceClassId, targetDate: entry.targetDate, targetTime: entry.targetTime, status: 'failed', error: 'Error al crear la clase' })
        failed++
      }
    }

    return NextResponse.json({ created, failed, summary })
  } catch (error) {
    console.error('[DUPLICATE API] Error:', error)
    return NextResponse.json(
      { error: 'Error al duplicar clases' },
      { status: 500 }
    )
  }
}
