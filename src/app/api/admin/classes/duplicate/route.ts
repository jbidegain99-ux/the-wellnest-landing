import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { formatInSV, svLocalToUTC } from '@/lib/utils/timezone'
import { formatDateShort, getTodaySV } from '@/lib/schedule/classDates'
import { MAX_CLASSES_PER_DUPLICATE, allInOneWeek } from '@/lib/schedule/duplicateWeek'

const entrySchema = z.object({
  sourceClassId: z.string().min(1),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  targetTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
  instructorId: z.string().min(1),
  duration: z.number().int().min(15, 'La duración mínima es 15 minutos'),
  maxCapacity: z.number().int().min(1, 'La capacidad mínima es 1'),
})

const requestSchema = z.object({
  classes: z
    .array(entrySchema)
    .min(1, 'Debe seleccionar al menos una clase')
    .max(MAX_CLASSES_PER_DUPLICATE, `No se pueden duplicar más de ${MAX_CLASSES_PER_DUPLICATE} clases a la vez`),
})

// POST - Duplicar clases de UNA semana hacia UNA semana (o un solo día).
// Disciplina, disciplina complementaria y tipo de clase se toman de la clase
// original en la BD; la UI solo puede cambiar fecha, hora, instructor,
// duración y cupo. Fechas pasadas y choques del instructor se omiten.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 })
    }

    const entries = validation.data.classes
    const sourceIds = entries.map((e) => e.sourceClassId)

    if (new Set(sourceIds).size !== sourceIds.length) {
      return NextResponse.json({ error: 'Una clase aparece más de una vez en la duplicación' }, { status: 400 })
    }

    // Regla: solo se duplica una semana. Se valida aquí, no solo en la UI.
    if (!allInOneWeek(entries.map((e) => e.targetDate))) {
      return NextResponse.json(
        { error: 'Solo se puede duplicar hacia una semana a la vez (lunes a domingo)' },
        { status: 400 }
      )
    }

    const sources = await prisma.class.findMany({
      where: { id: { in: sourceIds }, isCancelled: false },
      select: {
        id: true,
        dateTime: true,
        disciplineId: true,
        complementaryDisciplineId: true,
        classType: true,
      },
    })

    if (sources.length !== sourceIds.length) {
      return NextResponse.json(
        { error: 'Alguna de las clases seleccionadas ya no existe o fue cancelada. Recarga la página.' },
        { status: 400 }
      )
    }

    if (!allInOneWeek(sources.map((s) => formatInSV(s.dateTime, 'yyyy-MM-dd')))) {
      return NextResponse.json(
        { error: 'Solo se pueden duplicar clases de una misma semana' },
        { status: 400 }
      )
    }

    const instructorIds = Array.from(new Set(entries.map((e) => e.instructorId)))
    const instructors = await prisma.instructor.findMany({
      where: { id: { in: instructorIds } },
      select: { id: true },
    })
    if (instructors.length !== instructorIds.length) {
      return NextResponse.json({ error: 'Instructor no encontrado' }, { status: 400 })
    }

    const sourceById = new Map(sources.map((s) => [s.id, s]))
    const todaySV = getTodaySV()
    const now = new Date()

    const skipped: Array<{ label: string; reason: string }> = []
    const candidates: Array<{ entry: (typeof entries)[number]; dateTime: Date; label: string }> = []

    for (const entry of entries) {
      const [year, month, day] = entry.targetDate.split('-').map(Number)
      const [hours, minutes] = entry.targetTime.split(':').map(Number)
      const dateTime = svLocalToUTC(year, month - 1, day, hours, minutes)
      const label = `${formatDateShort(entry.targetDate)} ${entry.targetTime}`

      if (entry.targetDate < todaySV || dateTime <= now) {
        skipped.push({ label, reason: 'La fecha ya pasó' })
        continue
      }
      candidates.push({ entry, dateTime, label })
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No se creó ninguna clase: todas las fechas destino ya pasaron.', skipped },
        { status: 400 }
      )
    }

    // Choques de horario: una consulta por el rango de la semana destino.
    const times = candidates.map((c) => c.dateTime.getTime())
    const existing = await prisma.class.findMany({
      where: {
        instructorId: { in: instructorIds },
        isCancelled: false,
        dateTime: {
          gte: new Date(Math.min(...times) - 24 * 60 * 60 * 1000),
          lte: new Date(Math.max(...times) + 24 * 60 * 60 * 1000),
        },
      },
      select: { instructorId: true, dateTime: true, duration: true },
    })

    // Incluye las clases del propio lote a medida que se aceptan.
    const slots = existing.map((c) => ({
      instructorId: c.instructorId,
      start: c.dateTime.getTime(),
      duration: c.duration,
    }))
    const overlaps = (startA: number, durA: number, startB: number, durB: number) =>
      startA < startB + durB * 60000 && startB < startA + durA * 60000

    const toCreate: Array<{
      disciplineId: string
      complementaryDisciplineId: string | null
      instructorId: string
      dateTime: Date
      duration: number
      maxCapacity: number
      classType: string | null
      isRecurring: boolean
    }> = []

    for (const { entry, dateTime, label } of candidates) {
      const start = dateTime.getTime()
      const clash = slots.some(
        (s) => s.instructorId === entry.instructorId && overlaps(start, entry.duration, s.start, s.duration)
      )
      if (clash) {
        skipped.push({ label, reason: 'El instructor ya tiene una clase a esa hora' })
        continue
      }

      const source = sourceById.get(entry.sourceClassId)!
      slots.push({ instructorId: entry.instructorId, start, duration: entry.duration })
      toCreate.push({
        disciplineId: source.disciplineId,
        complementaryDisciplineId: source.complementaryDisciplineId,
        instructorId: entry.instructorId,
        dateTime,
        duration: entry.duration,
        maxCapacity: entry.maxCapacity,
        classType: source.classType,
        isRecurring: false,
      })
    }

    if (toCreate.length === 0) {
      return NextResponse.json({ error: 'No se creó ninguna clase.', skipped }, { status: 400 })
    }

    const result = await prisma.class.createMany({ data: toCreate })

    const verb = result.count === 1 ? 'creó' : 'crearon'
    const message =
      skipped.length > 0
        ? `Se ${verb} ${result.count} clase(s). ${skipped.length} se omitieron.`
        : `Se ${verb} ${result.count} clase(s) correctamente`

    return NextResponse.json({ message, created: result.count, skipped })
  } catch (error) {
    console.error('[DUPLICATE API] Error:', error)
    return NextResponse.json({ error: 'Error al duplicar clases' }, { status: 500 })
  }
}
