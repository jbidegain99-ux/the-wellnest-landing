import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadAttendedClasses } from '@/lib/progress/load'
import { currentChallenge, evaluateBadges } from '@/lib/progress/badges/evaluate'
import type { BadgeState, BadgesResponse } from '@/lib/progress/badges/types'
import { localParts } from '@/lib/progress/time'

export const dynamic = 'force-dynamic'

/** Los retos de otros años muestran el año: "Reto de octubre 2025". */
function withChallengeYear(badge: BadgeState, currentYear: number): BadgeState {
  if (badge.category !== 'reto') return badge
  const m = badge.id.match(/^reto-(\d{4})-\d{2}$/)
  if (!m || Number(m[1]) === currentYear) return badge
  return { ...badge, title: `${badge.title} ${m[1]}` }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const classes = await loadAttendedClasses(session.user.id)
    // La misma fecha para evaluar y para buscar el reto del mes.
    const now = new Date()
    const year = localParts(now).year
    const badges = evaluateBadges(classes, now).map((b) => withChallengeYear(b, year))
    const challenge = currentChallenge(badges, now)
    const earnedCount = badges.filter((b) => b.earnedAt !== null).length

    const body: BadgesResponse = { badges, challenge, earnedCount }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error fetching badges:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
