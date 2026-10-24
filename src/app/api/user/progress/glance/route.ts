import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loadAttendedClasses } from '@/lib/progress/load'
import { buildGlance, type ProgressGlance } from '@/lib/progress/glance'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const classes = await loadAttendedClasses(session.user.id)
    const body: ProgressGlance = buildGlance(classes, new Date())
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error fetching progress glance:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
