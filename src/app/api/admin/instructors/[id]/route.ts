import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateInstructorSchema = z.object({
  name: z.string().min(2, 'El nombre es muy corto').optional(),
  bio: z.string().min(10, 'La biografía debe tener al menos 10 caracteres').optional(),
  disciplines: z.array(z.string()).min(1, 'Debe seleccionar al menos una disciplina').optional(),
  image: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().optional(),
})

// GET - Fetch a single instructor
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

    const instructor = await prisma.instructor.findUnique({
      where: { id },
    })

    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(instructor)
  } catch (error) {
    console.error('Error fetching instructor:', error)
    return NextResponse.json(
      { error: 'Error al obtener el instructor' },
      { status: 500 }
    )
  }
}

// PUT - Update an instructor
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
    const validation = updateInstructorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    // Check if instructor exists
    const existingInstructor = await prisma.instructor.findUnique({
      where: { id },
    })

    if (!existingInstructor) {
      return NextResponse.json(
        { error: 'Instructor no encontrado' },
        { status: 404 }
      )
    }

    const data = validation.data
    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.disciplines !== undefined) updateData.disciplines = data.disciplines
    if (data.image !== undefined) updateData.image = data.image
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.order !== undefined) updateData.order = data.order

    const instructor = await prisma.instructor.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Instructor actualizado correctamente',
      instructor,
    })
  } catch (error) {
    console.error('Error updating instructor:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el instructor' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an instructor
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

    // Check if instructor exists
    const existingInstructor = await prisma.instructor.findUnique({
      where: { id },
    })

    if (!existingInstructor) {
      return NextResponse.json(
        { error: 'Instructor no encontrado' },
        { status: 404 }
      )
    }

    // Check if instructor has any associated classes
    const classCount = await prisma.class.count({
      where: { instructorId: id },
    })

    if (classCount > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar este instructor porque tiene ${classCount} clase(s) asociadas. Primero elimine o reasigne las clases.`
        },
        { status: 400 }
      )
    }

    await prisma.instructor.delete({
      where: { id },
    })

    return NextResponse.json({
      message: 'Instructor eliminado correctamente',
    })
  } catch (error) {
    console.error('Error deleting instructor:', error)
    return NextResponse.json(
      { error: 'Error al eliminar el instructor' },
      { status: 500 }
    )
  }
}
