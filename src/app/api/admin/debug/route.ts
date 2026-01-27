import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering (uses headers via getServerSession)
export const dynamic = 'force-dynamic'

// Official data for duplicate detection
const OFFICIAL_DISCIPLINE_SLUGS = ['yoga', 'pilates', 'pole', 'soundbath', 'nutricion']
const OFFICIAL_INSTRUCTOR_IDS = [
  'instructor-nicolle', 'instructor-florence', 'instructor-adriana',
  'instructor-kevin', 'instructor-denisse',
]

// Helper to format date for El Salvador timezone
function toElSalvadorString(utcDate: Date): string {
  return utcDate.toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })
}

// Debug endpoint to inspect database state
// Use ?week=true to see this week's classes
// Use ?discipline=yoga to filter by discipline slug
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showWeek = searchParams.get('week') === 'true'
    const filterDiscipline = searchParams.get('discipline')

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

    // Get class count by discipline with discipline names
    const classesByDiscipline = await prisma.class.groupBy({
      by: ['disciplineId'],
      _count: { id: true },
    })

    // Enrich with discipline names
    const classesByDisciplineEnriched = classesByDiscipline.map(item => {
      const discipline = allDisciplines.find(d => d.id === item.disciplineId)
      return {
        disciplineId: item.disciplineId,
        disciplineName: discipline?.name || 'UNKNOWN',
        disciplineSlug: discipline?.slug || 'UNKNOWN',
        count: item._count.id,
      }
    })

    // Get classes for this week if requested
    let weekClasses: Array<{
      id: string
      dateTimeUTC: string
      dateTimeElSalvador: string
      discipline: { id: string; name: string; slug: string }
      instructor: { id: string; name: string }
      isCancelled: boolean
    }> = []

    if (showWeek) {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      const weekClassesRaw = await prisma.class.findMany({
        where: {
          dateTime: { gte: startOfWeek, lte: endOfWeek },
          ...(filterDiscipline ? {
            discipline: { slug: filterDiscipline },
          } : {}),
        },
        include: {
          discipline: { select: { id: true, name: true, slug: true } },
          instructor: { select: { id: true, name: true } },
        },
        orderBy: { dateTime: 'asc' },
      })

      weekClasses = weekClassesRaw.map(c => ({
        id: c.id,
        dateTimeUTC: c.dateTime.toISOString(),
        dateTimeElSalvador: toElSalvadorString(c.dateTime),
        discipline: c.discipline,
        instructor: c.instructor,
        isCancelled: c.isCancelled,
      }))
    }

    // Get recent classes (by date, descending - most recent first)
    const recentClasses = await prisma.class.findMany({
      take: 20,
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
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
      classesByDiscipline: classesByDisciplineEnriched,
      weekClasses: showWeek ? weekClasses : 'Use ?week=true to see this week\'s classes',
      recentClasses: recentClasses.map(c => ({
        id: c.id,
        dateTimeUTC: c.dateTime.toISOString(),
        dateTimeElSalvador: toElSalvadorString(c.dateTime),
        discipline: c.discipline,
        instructor: c.instructor,
        isCancelled: c.isCancelled,
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
      usage: {
        showWeekClasses: '/api/admin/debug?week=true',
        filterByDiscipline: '/api/admin/debug?week=true&discipline=yoga',
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
