import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
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

    const classes = await loadAttendedClasses(session.user.id)
    return NextResponse.json(buildProgressSummary(classes, new Date()))
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
