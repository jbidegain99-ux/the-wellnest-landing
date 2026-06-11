import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { buildClassCancelledEmail, formatDateTimeShort, sendEmail } from '@/lib/emailService'

// El Salvador is UTC-6. To store times that display correctly for El Salvador users,
// we need to add 6 hours to the desired local time to get UTC.
const EL_SALVADOR_UTC_OFFSET = 6

function getElSalvadorTime(utcDate: Date): string {
  const elSalvadorDate = new Date(utcDate.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  const hours = elSalvadorDate.getUTCHours().toString().padStart(2, '0')
  const minutes = elSalvadorDate.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function getElSalvadorDayOfWeek(utcDate: Date): number {
  const elSalvadorDate = new Date(utcDate.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
  return elSalvadorDate.getUTCDay()
}

const updateClassSchema = z.object({
  disciplineId: z.string().optional(),
  complementaryDisciplineId: z.string().nullable().optional(),
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
      complementaryDisciplineId: cls.complementaryDisciplineId,
      complementaryDiscipline: cls.complementaryDiscipline?.name || null,
      instructorId: cls.instructorId,
      instructor: cls.instructor.name,
      dateTime: cls.dateTime,
      time: getElSalvadorTime(cls.dateTime),
      dayOfWeek: getElSalvadorDayOfWeek(cls.dateTime),
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

    if (data.complementaryDisciplineId !== undefined) {
      if (data.complementaryDisciplineId === null) {
        updateData.complementaryDisciplineId = null
      } else {
        const compDiscipline = await prisma.discipline.findUnique({
          where: { id: data.complementaryDisciplineId },
        })
        if (!compDiscipline) {
          return NextResponse.json(
            { error: 'La disciplina complementaria no existe' },
            { status: 400 }
          )
        }
        const primaryId = data.disciplineId || existingClass.disciplineId
        if (data.complementaryDisciplineId === primaryId) {
          return NextResponse.json(
            { error: 'La disciplina complementaria debe ser diferente a la principal' },
            { status: 400 }
          )
        }
        updateData.complementaryDisciplineId = data.complementaryDisciplineId
      }
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
      // Convert existing dateTime to El Salvador local date to preserve the correct date
      const esSvDate = new Date(existingClass.dateTime.getTime() - EL_SALVADOR_UTC_OFFSET * 60 * 60 * 1000)
      // Create new datetime: same El Salvador date, new El Salvador time → stored as UTC
      const newDateTime = new Date(Date.UTC(
        esSvDate.getUTCFullYear(),
        esSvDate.getUTCMonth(),
        esSvDate.getUTCDate(),
        hours + EL_SALVADOR_UTC_OFFSET,
        minutes
      ))
      updateData.dateTime = newDateTime
    }

    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.maxCapacity !== undefined) updateData.maxCapacity = data.maxCapacity
    if (data.classType !== undefined) updateData.classType = data.classType
    if (data.isCancelled !== undefined) updateData.isCancelled = data.isCancelled

    // Al cancelar la clase, las reservas confirmadas se cancelan, se devuelven
    // los créditos a cada paquete y se limpia la lista de espera — todo en una
    // transacción. Antes el flag isCancelled solo ocultaba la clase y los
    // alumnos perdían sus clases en silencio.
    const cancellingNow = data.isCancelled === true && !existingClass.isCancelled
    let cancellationSummary: {
      reservationsCancelled: number
      waitlistRemoved: number
      notifyUserIds: string[]
      refundsByUser: Map<string, number>
    } | null = null

    if (cancellingNow) {
      cancellationSummary = await prisma.$transaction(async (tx) => {
        const activeReservations = await tx.reservation.findMany({
          where: { classId: id, status: 'CONFIRMED' },
          select: { id: true, purchaseId: true, userId: true, isGuestReservation: true },
        })

        if (activeReservations.length > 0) {
          await tx.reservation.updateMany({
            where: { id: { in: activeReservations.map((r) => r.id) } },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          })
        }

        // Devolver créditos agrupados por purchase (host + invitado pueden
        // compartir la misma purchase y deben devolver 2)
        const refundsPerPurchase = new Map<string, number>()
        for (const r of activeReservations) {
          refundsPerPurchase.set(r.purchaseId, (refundsPerPurchase.get(r.purchaseId) ?? 0) + 1)
        }
        for (const [purchaseId, count] of Array.from(refundsPerPurchase.entries())) {
          await tx.purchase.update({
            where: { id: purchaseId },
            data: { classesRemaining: { increment: count } },
          })
        }
        if (refundsPerPurchase.size > 0) {
          await tx.purchase.updateMany({
            where: {
              id: { in: Array.from(refundsPerPurchase.keys()) },
              status: 'DEPLETED',
              classesRemaining: { gt: 0 },
            },
            data: { status: 'ACTIVE' },
          })
        }

        const removedWaitlist = await tx.waitlist.deleteMany({ where: { classId: id } })

        // Créditos devueltos por usuario titular (para el email)
        const refundsByUser = new Map<string, number>()
        for (const r of activeReservations) {
          refundsByUser.set(r.userId, (refundsByUser.get(r.userId) ?? 0) + 1)
        }

        return {
          reservationsCancelled: activeReservations.length,
          waitlistRemoved: removedWaitlist.count,
          notifyUserIds: Array.from(
            new Set(activeReservations.filter((r) => !r.isGuestReservation).map((r) => r.userId))
          ),
          refundsByUser,
        }
      })
    }

    const cls = await prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        discipline: true,
        complementaryDiscipline: true,
        instructor: true,
      },
    })

    // Notificar a los afectados (best-effort, después de la transacción)
    if (cancellationSummary && cancellationSummary.notifyUserIds.length > 0) {
      try {
        const affectedUsers = await prisma.user.findMany({
          where: { id: { in: cancellationSummary.notifyUserIds } },
          select: { id: true, email: true, name: true },
        })
        const baseUrl = process.env.NEXTAUTH_URL || 'https://wellneststudio.net'
        for (const user of affectedUsers) {
          if (!user.email) continue
          await sendEmail({
            to: user.email,
            subject: `Clase cancelada: ${cls.discipline.name} — Wellnest`,
            html: buildClassCancelledEmail({
              userName: user.name,
              disciplineName: cls.discipline.name,
              instructorName: cls.instructor.name,
              dateTime: formatDateTimeShort(cls.dateTime),
              classesRefunded: cancellationSummary.refundsByUser.get(user.id) ?? 1,
              profileUrl: `${baseUrl}/reservar`,
            }),
          }).catch((err) => {
            console.error('[ADMIN CLASSES] Failed to send cancellation email:', user.email, err)
          })
        }
      } catch (emailErr) {
        console.error('[ADMIN CLASSES] Cancellation emails failed (non-blocking):', emailErr)
      }
      console.log('[ADMIN CLASSES] Class cancelled with refunds:', {
        classId: id,
        ...{
          reservationsCancelled: cancellationSummary.reservationsCancelled,
          waitlistRemoved: cancellationSummary.waitlistRemoved,
        },
      })
    }

    return NextResponse.json({
      message: cancellationSummary
        ? `Clase cancelada. Se devolvieron créditos de ${cancellationSummary.reservationsCancelled} reserva(s) y se notificó a los alumnos.`
        : 'Clase actualizada correctamente',
      cancellation: cancellationSummary
        ? {
            reservationsCancelled: cancellationSummary.reservationsCancelled,
            waitlistRemoved: cancellationSummary.waitlistRemoved,
          }
        : undefined,
      class: {
        id: cls.id,
        disciplineId: cls.disciplineId,
        discipline: cls.discipline.name,
        complementaryDisciplineId: cls.complementaryDisciplineId,
        complementaryDiscipline: cls.complementaryDiscipline?.name || null,
        instructorId: cls.instructorId,
        instructor: cls.instructor.name,
        dateTime: cls.dateTime,
        time: getElSalvadorTime(cls.dateTime),
        dayOfWeek: getElSalvadorDayOfWeek(cls.dateTime),
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
          select: {
            reservations: {
              where: { status: { not: 'CANCELLED' } },
            },
          },
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
