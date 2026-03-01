import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateDisciplineSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones').optional(),
  description: z.string().min(1).optional(),
  benefits: z.string().optional(),
  image: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

// GET - Fetch a single discipline
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

    const discipline = await prisma.discipline.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            classes: true,
            complementaryClasses: true,
            packages: true,
          },
        },
      },
    })

    if (!discipline) {
      return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 404 })
    }

    return NextResponse.json(discipline)
  } catch (error) {
    console.error('[ADMIN DISCIPLINAS] Error fetching:', error)
    return NextResponse.json({ error: 'Error al obtener disciplina' }, { status: 500 })
  }
}

// PUT - Update a discipline
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
    const validation = updateDisciplineSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const existing = await prisma.discipline.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 404 })
    }

    const data = validation.data

    // Check slug uniqueness if changing slug
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await prisma.discipline.findUnique({
        where: { slug: data.slug },
      })
      if (slugExists) {
        return NextResponse.json(
          { error: 'Ya existe una disciplina con ese slug' },
          { status: 400 }
        )
      }
    }

    const discipline = await prisma.discipline.update({
      where: { id },
      data,
    })

    return NextResponse.json(discipline)
  } catch (error) {
    console.error('[ADMIN DISCIPLINAS] Error updating:', error)
    return NextResponse.json({ error: 'Error al actualizar disciplina' }, { status: 500 })
  }
}

// DELETE - Delete a discipline
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

    const discipline = await prisma.discipline.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            classes: true,
            complementaryClasses: true,
            packages: true,
          },
        },
      },
    })

    if (!discipline) {
      return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 404 })
    }

    const totalUsage = discipline._count.classes + discipline._count.complementaryClasses + discipline._count.packages
    if (totalUsage > 0) {
      return NextResponse.json(
        {
          error: `Esta disciplina está en uso: ${discipline._count.classes} clases, ${discipline._count.complementaryClasses} complementarias, ${discipline._count.packages} paquetes. Desactívala en lugar de eliminarla.`,
        },
        { status: 400 }
      )
    }

    await prisma.discipline.delete({ where: { id } })

    return NextResponse.json({ message: 'Disciplina eliminada correctamente' })
  } catch (error) {
    console.error('[ADMIN DISCIPLINAS] Error deleting:', error)
    return NextResponse.json({ error: 'Error al eliminar disciplina' }, { status: 500 })
  }
}
