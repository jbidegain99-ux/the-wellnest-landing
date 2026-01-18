import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const instructorSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto'),
  headline: z.string().nullable().optional(),
  bio: z.string().optional().default(''),
  shortBio: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  disciplines: z.array(z.string()).optional().default([]),
  image: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  order: z.number().optional(),
})

// GET - Fetch all instructors (including inactive) for admin
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const instructors = await prisma.instructor.findMany({
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(instructors)
  } catch (error) {
    console.error('Error fetching instructors:', error)
    return NextResponse.json(
      { error: 'Error al obtener los instructores' },
      { status: 500 }
    )
  }
}

// POST - Create a new instructor
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = instructorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get the highest order number to place new instructor at the end
    const lastInstructor = await prisma.instructor.findFirst({
      orderBy: { order: 'desc' },
    })
    const newOrder = (lastInstructor?.order ?? 0) + 1

    const instructor = await prisma.instructor.create({
      data: {
        name: data.name,
        headline: data.headline || null,
        bio: data.bio || '',
        shortBio: data.shortBio || null,
        tags: data.tags || [],
        disciplines: data.disciplines || [],
        image: data.image || null,
        isActive: data.isActive,
        order: data.order ?? newOrder,
      },
    })

    // Revalidate the /equipo page to show the new instructor
    revalidatePath('/equipo')

    return NextResponse.json({
      message: 'Instructor creado correctamente',
      instructor,
    })
  } catch (error) {
    console.error('Error creating instructor:', error)
    return NextResponse.json(
      { error: 'Error al crear el instructor' },
      { status: 500 }
    )
  }
}
