import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        discipline: true,
        complementaryDiscipline: true,
        instructor: true,
        _count: {
          select: {
            reservations: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
      },
    })

    if (!classData) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(classData)
  } catch (error) {
    console.error('Error fetching class:', error)
    return NextResponse.json(
      { error: 'Error al obtener la clase' },
      { status: 500 }
    )
  }
}
