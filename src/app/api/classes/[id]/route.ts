import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Endpoint público: las clases privadas (sesiones 1:1) y canceladas no
    // deben ser visibles ni direccionables por id
    const classData = await prisma.class.findFirst({
      where: { id, isPrivate: false, isCancelled: false },
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
