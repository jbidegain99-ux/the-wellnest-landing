import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { formatInSV } from '@/lib/utils/timezone'

const MAX_IDS_PER_BATCH = 100

const bulkDeleteSchema = z.object({
  classIds: z
    .array(z.string().min(1))
    .min(1, 'Debe seleccionar al menos una clase')
    .max(MAX_IDS_PER_BATCH, `No se pueden eliminar más de ${MAX_IDS_PER_BATCH} clases a la vez`),
})

export interface SkippedClass {
  id: string
  label: string
  reservationsCount: number
}

// POST - Eliminar varias clases de una sola vez.
// Las clases con reservas activas se omiten (no se borran ni se cancelan) y
// se devuelven en `skipped` para que la admin decida qué hacer con ellas.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = bulkDeleteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const classIds = Array.from(new Set(validation.data.classIds))

    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      include: {
        discipline: { select: { name: true } },
        _count: {
          select: {
            reservations: {
              where: { status: { not: 'CANCELLED' } },
            },
          },
        },
      },
    })

    if (classes.length === 0) {
      return NextResponse.json(
        { error: 'No se encontró ninguna de las clases seleccionadas' },
        { status: 404 }
      )
    }

    const deletableIds: string[] = []
    const skipped: SkippedClass[] = []

    for (const cls of classes) {
      if (cls._count.reservations > 0) {
        skipped.push({
          id: cls.id,
          label: `${cls.discipline.name} · ${formatInSV(cls.dateTime, "EEE d MMM 'a las' h:mm a")}`,
          reservationsCount: cls._count.reservations,
        })
      } else {
        deletableIds.push(cls.id)
      }
    }

    let deleted = 0
    if (deletableIds.length > 0) {
      const result = await prisma.class.deleteMany({
        where: { id: { in: deletableIds } },
      })
      deleted = result.count
    }

    console.log('[BULK DELETE CLASSES] deleted:', deleted, 'skipped:', skipped.length)

    return NextResponse.json({ deleted, skipped })
  } catch (error) {
    console.error('[BULK DELETE CLASSES] Error:', error)
    return NextResponse.json(
      { error: 'Error al eliminar las clases' },
      { status: 500 }
    )
  }
}
