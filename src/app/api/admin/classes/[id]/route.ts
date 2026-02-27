import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { setHours, setMinutes } from 'date-fns'

const updateClassSchema = z.object({
  disciplineId: z.string().optional(),
  instructorId: z.string().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido').optional(),
  duration: z.number().min(15).optional(),
  maxCapacity: z.number().min(1).optional(),
  classType: z.string().nullable().optional(),
  isCancelled: z.boolean().optional(),
})

// GET - Fetch a single class
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        discipline: true,
        instructor: true,
        _count: {
          select: { reservations: true },
        },
      },
    })

    if (!cls) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Error fetching class:', error)
    return NextResponse.json(
      { error: 'Error al obtener la clase' },
      { status: 500 }
    )
  }
}

// PUT - Update a class
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateClassSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id },
    })

    if (!existingClass) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    const data = validation.data
    const updateData: Record<string, unknown> = {}

    if (data.disciplineId !== undefined) {
      const discipline = await prisma.discipline.findUnique({
        where: { id: data.disciplineId },
      })
      if (!discipline) {
        return NextResponse.json(
          { error: 'La disciplina no existe' },
          { status: 400 }
        )
      }
      updateData.disciplineId = data.disciplineId
    }

    if (data.instructorId !== undefined) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: data.instructorId },
      })
      if (!instructor) {
        return NextResponse.json(
          { error: 'El instructor no existe' },
          { status: 400 }
        )
      }
      updateData.instructorId = data.instructorId
    }

    if (data.time !== undefined) {
      const [hours, minutes] = data.time.split(':').map(Number)
      // Keep the same date but update the time
      const newDateTime = setMinutes(setHours(existingClass.dateTime, hours), minutes)
      updateData.dateTime = newDateTime
    }

    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.maxCapacity !== undefined) updateData.maxCapacity = data.maxCapacity
    if (data.classType !== undefined) updateData.classType = data.classType
    if (data.isCancelled !== undefined) updateData.isCancelled = data.isCancelled

    const cls = await prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        discipline: true,
        instructor: true,
      },
    })

    return NextResponse.json({
      message: 'Clase actualizada correctamente',
      class: {
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
        isCancelled: cls.isCancelled,
      },
    })
  } catch (error) {
    console.error('Error updating class:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la clase' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a class
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: { reservations: true },
        },
      },
    })

    if (!existingClass) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    // Check if class has reservations
    if (existingClass._count.reservations > 0) {
      return NextResponse.json(
        {
          error: `Esta clase tiene ${existingClass._count.reservations} reservación(es). Cancela las reservaciones primero o marca la clase como cancelada.`
        },
        { status: 400 }
      )
    }

    await prisma.class.delete({
      where: { id },
    })

    return NextResponse.json({
      message: 'Clase eliminada correctamente',
    })
  } catch (error) {
    console.error('Error deleting class:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la clase' },
      { status: 500 }
    )
  }
}
