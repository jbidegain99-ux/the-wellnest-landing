import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadAttendedClasses } from '@/lib/progress/load'
import { currentChallenge, evaluateBadges } from '@/lib/progress/badges/evaluate'
import { withChallengeYear } from '@/lib/progress/badges/display'
import type { BadgesResponse } from '@/lib/progress/badges/types'
import { localParts } from '@/lib/progress/time'

export const dynamic = 'force-dynamic'

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
