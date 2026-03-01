import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createDisciplineSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  slug: z.string().min(1, 'El slug es requerido').regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  description: z.string().min(1, 'La descripción es requerida'),
  benefits: z.string().default(''),
  image: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

// GET - List all disciplines (admin view, includes inactive)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const disciplines = await prisma.discipline.findMany({
      orderBy: { order: 'asc' },
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

    return NextResponse.json(disciplines)
  } catch (error) {
    console.error('[ADMIN DISCIPLINAS] Error fetching:', error)
    return NextResponse.json({ error: 'Error al obtener disciplinas' }, { status: 500 })
  }
}

// POST - Create a new discipline
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createDisciplineSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check slug uniqueness
    const existing = await prisma.discipline.findUnique({
      where: { slug: data.slug },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una disciplina con ese slug' },
        { status: 400 }
      )
    }

    const discipline = await prisma.discipline.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        benefits: data.benefits,
        image: data.image ?? null,
        icon: data.icon ?? null,
        order: data.order,
        isActive: data.isActive,
      },
    })

    return NextResponse.json(discipline, { status: 201 })
  } catch (error) {
    console.error('[ADMIN DISCIPLINAS] Error creating:', error)
    return NextResponse.json({ error: 'Error al crear disciplina' }, { status: 500 })
  }
}
