import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const disciplines = await prisma.discipline.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(disciplines)
  } catch (error) {
    console.error('Error fetching disciplines:', error)
    return NextResponse.json(
      { error: 'Error al obtener las disciplinas' },
      { status: 500 }
    )
  }
}
