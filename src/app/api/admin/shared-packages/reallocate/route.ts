import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reallocateSchema = z.object({
  fromPurchaseId: z.string().min(1),
  toPurchaseId: z.string().min(1),
  classCount: z.number().int().positive(),
})

// POST - move classes between purchases in the same shared group
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = reallocateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { fromPurchaseId, toPurchaseId, classCount } = validation.data

    if (fromPurchaseId === toPurchaseId) {
      return NextResponse.json(
        { error: 'No se puede reasignar al mismo purchase' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromPurchase = await tx.purchase.findUnique({
        where: { id: fromPurchaseId },
      })
      const toPurchase = await tx.purchase.findUnique({
        where: { id: toPurchaseId },
      })

      if (!fromPurchase || !toPurchase) {
        throw new Error('Una o ambas compras no existen')
      }

      if (
        !fromPurchase.sharedGroupId ||
        fromPurchase.sharedGroupId !== toPurchase.sharedGroupId
      ) {
        throw new Error('Las compras no pertenecen al mismo grupo compartido')
      }

      if (fromPurchase.classesRemaining < classCount) {
        throw new Error(
          `Clases insuficientes. Disponibles: ${fromPurchase.classesRemaining}`
        )
      }

      await tx.purchase.update({
        where: { id: fromPurchaseId },
        data: {
          classesRemaining: { decrement: classCount },
          classesAllocated: (fromPurchase.classesAllocated ?? fromPurchase.classesRemaining) - classCount,
        },
      })

      await tx.purchase.update({
        where: { id: toPurchaseId },
        data: {
          classesRemaining: { increment: classCount },
          classesAllocated: (toPurchase.classesAllocated ?? toPurchase.classesRemaining) + classCount,
          status: 'ACTIVE', // reactivate if was depleted
        },
      })

      return {
        fromRemaining: fromPurchase.classesRemaining - classCount,
        toRemaining: toPurchase.classesRemaining + classCount,
      }
    })

    console.log('[ADMIN] Classes reallocated:', {
      fromPurchaseId,
      toPurchaseId,
      classCount,
      adminId: session.user.id,
    })

    return NextResponse.json({
      message: `${classCount} clase(s) reasignadas exitosamente`,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al reasignar clases'
    console.error('Error reallocating classes:', error)

    if (error instanceof Error && (
      message.includes('no existen') ||
      message.includes('mismo grupo') ||
      message.includes('insuficientes')
    )) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
