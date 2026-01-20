import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Only return the 4 official class disciplines (nutricion is not a class)
const OFFICIAL_DISCIPLINE_SLUGS = [
  'yoga',
  'pilates',
  'pole',
  'soundbath',
]

export async function GET() {
  try {
    const disciplines = await prisma.discipline.findMany({
      where: {
        isActive: true,
        slug: { in: OFFICIAL_DISCIPLINE_SLUGS },
      },
      orderBy: { order: 'asc' },
    })

    console.log(`[DISCIPLINES API] Returning ${disciplines.length} official disciplines`)

    return NextResponse.json(disciplines)
  } catch (error) {
    console.error('Error fetching disciplines:', error)
    return NextResponse.json(
      { error: 'Error al obtener las disciplinas' },
      { status: 500 }
    )
  }
}
