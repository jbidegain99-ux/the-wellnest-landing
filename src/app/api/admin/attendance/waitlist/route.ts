import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { moveInQueue } from '@/lib/booking/waitlistOrder'

export const dynamic = 'force-dynamic'

interface MoveBody {
  waitlistId?: unknown
  toPosition?: unknown
}

/**
 * PATCH - Mover a una usuaria de lugar en la lista de espera de una clase.
 * Body: { waitlistId: string, toPosition: number } (1 = primera en entrar).
 *
 * Reescribe las posiciones 1..N de toda la cola dentro de una transacción que
 * bloquea la fila de la clase, igual que la promoción automática, para que dos
 * cambios simultáneos no dejen posiciones repetidas o con huecos.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as MoveBody | null
    const waitlistId = typeof body?.waitlistId === 'string' ? body.waitlistId : ''
    const toPosition = typeof body?.toPosition === 'number' ? body.toPosition : NaN
    if (!waitlistId || !Number.isInteger(toPosition)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const entry = await prisma.waitlist.findUnique({
      where: { id: waitlistId },
      select: { id: true, classId: true, user: { select: { name: true } } },
    })
    if (!entry) {
      return NextResponse.json({ error: 'La usuaria ya no está en la lista de espera' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ isCancelled: boolean; dateTime: Date }>>`
        SELECT "isCancelled", "dateTime" FROM "Class" WHERE id = ${entry.classId} FOR UPDATE`
      if (rows.length === 0 || rows[0].isCancelled) {
        return { error: 'La clase está cancelada', status: 409 as const }
      }
      if (rows[0].dateTime <= new Date()) {
        return { error: 'La clase ya empezó; la lista de espera ya no se usa', status: 409 as const }
      }

      const queue = await tx.waitlist.findMany({
        where: { classId: entry.classId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, position: true },
      })
      const nextOrder = moveInQueue(
        queue.map((q) => q.id),
        waitlistId,
        toPosition
      )
      if (!nextOrder) {
        return { error: 'Posición fuera de rango o la usuaria ya no está en la cola', status: 400 as const }
      }

      const currentPosition = new Map(queue.map((q) => [q.id, q.position]))
      for (let i = 0; i < nextOrder.length; i++) {
        const newPosition = i + 1
        if (currentPosition.get(nextOrder[i]) !== newPosition) {
          await tx.waitlist.update({
            where: { id: nextOrder[i] },
            data: { position: newPosition },
          })
        }
      }
      return { ok: true as const, total: nextOrder.length }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    console.log('[WAITLIST ADMIN] Moved entry:', {
      by: session.user?.id,
      waitlistId,
      classId: entry.classId,
      toPosition,
    })

    return NextResponse.json({
      success: true,
      message:
        toPosition === 1
          ? `${entry.user.name} quedó de primera en la lista de espera`
          : `${entry.user.name} ahora está en el lugar #${toPosition}`,
    })
  } catch (error) {
    console.error('[WAITLIST ADMIN] Error moving entry:', error)
    return NextResponse.json({ error: 'Error al mover en la lista de espera' }, { status: 500 })
  }
}
