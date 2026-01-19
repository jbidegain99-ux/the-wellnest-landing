import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Official data for duplicate detection
const OFFICIAL_DISCIPLINE_SLUGS = ['yoga', 'pilates', 'pole', 'soundbath', 'nutricion']
const OFFICIAL_INSTRUCTOR_IDS = [
  'instructor-nicolle', 'instructor-florence', 'instructor-adriana',
  'instructor-kevin', 'instructor-denisse',
]

// Debug endpoint to inspect database state
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get all disciplines (including inactive)
    const allDisciplines = await prisma.discipline.findMany({
      orderBy: { order: 'asc' },
    })

    // Get all instructors (including inactive)
    const allInstructors = await prisma.instructor.findMany({
      orderBy: { order: 'asc' },
    })

    // Get all packages
    const packages = await prisma.package.findMany({
      select: { id: true, name: true, slug: true, isActive: true },
      orderBy: { order: 'asc' },
    })

    // Get class count by discipline
    const classesByDiscipline = await prisma.class.groupBy({
      by: ['disciplineId'],
      _count: { id: true },
    })

    // Get recent classes
    const recentClasses = await prisma.class.findMany({
      take: 10,
      orderBy: { dateTime: 'desc' },
      include: {
        discipline: { select: { id: true, name: true, slug: true } },
        instructor: { select: { id: true, name: true } },
      },
    })

    // Detect potential duplicates
    const duplicateDisciplines = allDisciplines.filter(d => !OFFICIAL_DISCIPLINE_SLUGS.includes(d.slug))
    const duplicateInstructors = allInstructors.filter(i => !OFFICIAL_INSTRUCTOR_IDS.includes(i.id))

    // Group disciplines by name to find exact duplicates
    const disciplinesByName: Record<string, typeof allDisciplines> = {}
    allDisciplines.forEach(d => {
      if (!disciplinesByName[d.name]) {
        disciplinesByName[d.name] = []
      }
      disciplinesByName[d.name].push(d)
    })
    const exactDuplicateDisciplines = Object.entries(disciplinesByName)
      .filter(([, list]) => list.length > 1)
      .map(([name, list]) => ({ name, duplicates: list }))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      disciplines: allDisciplines.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        isActive: d.isActive,
        order: d.order,
        isOfficial: OFFICIAL_DISCIPLINE_SLUGS.includes(d.slug),
      })),
      instructors: allInstructors.map(i => ({
        id: i.id,
        name: i.name,
        isActive: i.isActive,
        disciplines: i.disciplines,
        isOfficial: OFFICIAL_INSTRUCTOR_IDS.includes(i.id),
      })),
      packages: packages,
      classesByDiscipline: classesByDiscipline,
      recentClasses: recentClasses.map(c => ({
        id: c.id,
        dateTime: c.dateTime,
        discipline: c.discipline,
        instructor: c.instructor,
      })),
      warnings: {
        unofficialDisciplines: duplicateDisciplines.map(d => ({ id: d.id, name: d.name, slug: d.slug })),
        unofficialInstructors: duplicateInstructors.map(i => ({ id: i.id, name: i.name })),
        exactDuplicateDisciplines: exactDuplicateDisciplines,
      },
      summary: {
        totalDisciplines: allDisciplines.length,
        activeDisciplines: allDisciplines.filter(d => d.isActive).length,
        officialDisciplines: allDisciplines.filter(d => OFFICIAL_DISCIPLINE_SLUGS.includes(d.slug)).length,
        totalInstructors: allInstructors.length,
        activeInstructors: allInstructors.filter(i => i.isActive).length,
        officialInstructors: allInstructors.filter(i => OFFICIAL_INSTRUCTOR_IDS.includes(i.id)).length,
        totalPackages: packages.length,
        activePackages: packages.filter(p => p.isActive).length,
      },
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Error fetching debug data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
