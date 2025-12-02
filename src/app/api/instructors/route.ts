import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const instructors = await prisma.instructor.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        order: 'asc',
      },
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
