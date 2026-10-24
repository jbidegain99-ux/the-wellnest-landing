import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Respuesta de `GET/PUT /api/user/progress-email`. */
interface ProgressEmailPref {
  enabled: boolean
}

/** GET: si la usuaria recibe el resumen por correo (encendido salvo baja). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const optOut = await prisma.progressEmailOptOut.findUnique({
      where: { userId: session.user.id },
      select: { userId: true },
    })
    const body: ProgressEmailPref = { enabled: optOut === null }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error fetching progress email preference:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** PUT `{ enabled }`: apagar crea la baja; encender la borra. */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }
    const enabled =
      typeof payload === 'object' && payload !== null && 'enabled' in payload
        ? (payload as { enabled: unknown }).enabled
        : undefined
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const userId = session.user.id
    if (enabled) {
      await prisma.progressEmailOptOut.deleteMany({ where: { userId } })
    } else {
      await prisma.progressEmailOptOut.upsert({ where: { userId }, create: { userId }, update: {} })
    }

    const body: ProgressEmailPref = { enabled }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error updating progress email preference:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
