import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { loadAttendedClasses } from '@/lib/progress/load'
import { buildProgressSummary } from '@/lib/progress/summary'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // Fetch all past reservations (class dateTime < now)
    const reservations = await prisma.reservation.findMany({
      where: {
        userId,
        isGuestReservation: false,
        class: {
          dateTime: { lt: now },
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

    // Racha semanal: mismo cálculo que Mi progreso (semanas lunes–domingo en
    // hora de El Salvador; si esta semana aún no hay clase, cuenta desde la anterior).
    const streak = buildProgressSummary(await loadAttendedClasses(userId), now).streak.weeks

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
