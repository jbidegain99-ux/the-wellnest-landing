import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const disciplineId = searchParams.get('disciplineId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {
      isCancelled: false,
    }

    if (disciplineId) {
      where.disciplineId = disciplineId
    }

    if (startDate && endDate) {
      where.dateTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const classes = await prisma.class.findMany({
      where,
      include: {
        discipline: true,
        instructor: true,
        _count: {
          select: { reservations: true },
        },
      },
      orderBy: { dateTime: 'asc' },
    })

    return NextResponse.json(classes)
  } catch (error) {
    console.error('Error fetching classes:', error)
    return NextResponse.json(
      { error: 'Error al obtener las clases' },
      { status: 500 }
    )
  }
}
