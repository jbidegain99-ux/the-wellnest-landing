import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all past reservations (class dateTime < now)
    const reservations = await prisma.reservation.findMany({
      where: {
        userId,
        isGuestReservation: false,
        class: {
          dateTime: { lt: new Date() },
        },
      },
      select: {
        id: true,
        status: true,
        checkedIn: true,
        class: {
          select: {
            dateTime: true,
            duration: true,
            discipline: { select: { name: true, slug: true } },
            instructor: { select: { name: true } },
          },
        },
      },
      orderBy: {
        class: { dateTime: 'desc' },
      },
    })

    // Compute stats from real data
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const attended = reservations.filter(r => r.status === 'ATTENDED' || r.checkedIn)
    const thisMonth = attended.filter(r => new Date(r.class.dateTime) >= monthStart)

    // Classes per discipline
    const disciplineCounts: Record<string, number> = {}
    for (const r of attended) {
      const name = r.class.discipline.name
      disciplineCounts[name] = (disciplineCounts[name] || 0) + 1
    }

    // Favorite discipline
    let favoriteDiscipline = '-'
    let maxCount = 0
    for (const [name, count] of Object.entries(disciplineCounts)) {
      if (count > maxCount) {
        maxCount = count
        favoriteDiscipline = name
      }
    }

    // Weekly streak: count consecutive weeks (from current week backwards) with at least 1 attended class
    let streak = 0
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
    currentWeekStart.setHours(0, 0, 0, 0)

    for (let weekOffset = 0; weekOffset < 52; weekOffset++) {
      const weekStart = new Date(currentWeekStart.getTime() - weekOffset * oneWeekMs)
      const weekEnd = new Date(weekStart.getTime() + oneWeekMs)
      const hasClass = attended.some(r => {
        const d = new Date(r.class.dateTime)
        return d >= weekStart && d < weekEnd
      })
      if (hasClass) {
        streak++
      } else {
        break
      }
    }

    return NextResponse.json({
      reservations: reservations.map(r => ({
        id: r.id,
        status: r.status,
        checkedIn: r.checkedIn,
        className: r.class.discipline.name,
        disciplineSlug: r.class.discipline.slug,
        instructor: r.class.instructor.name,
        dateTime: r.class.dateTime,
        duration: r.class.duration,
      })),
      stats: {
        totalClasses: attended.length,
        thisMonth: thisMonth.length,
        streak,
        favoriteDiscipline,
        classesPerDiscipline: disciplineCounts,
      },
    })
  } catch (error) {
    console.error('Error fetching user history:', error)
    return NextResponse.json(
      { error: 'Error al obtener el historial' },
      { status: 500 }
    )
  }
}
