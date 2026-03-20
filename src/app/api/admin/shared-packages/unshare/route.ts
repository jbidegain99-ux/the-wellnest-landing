import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const unshareSchema = z.object({
  childPurchaseId: z.string().min(1, 'Se requiere el ID de la compra hijo'),
})

// POST - reclaim classes from a child purchase back to the original
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = unshareSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { childPurchaseId } = validation.data

    const result = await prisma.$transaction(async (tx) => {
      const child = await tx.purchase.findUnique({
        where: { id: childPurchaseId },
        include: { user: { select: { name: true } } },
      })

      if (!child) {
        throw new Error('Compra no encontrada')
      }

      if (!child.sharedFromId || !child.sharedGroupId) {
        throw new Error('Esta compra no es un paquete compartido hijo')
      }

      const original = await tx.purchase.findUnique({
        where: { id: child.sharedFromId },
      })

      if (!original) {
        throw new Error('Compra original no encontrada')
      }

      // Only reclaim remaining classes (not already used)
      const classesToReclaim = child.classesRemaining

      if (classesToReclaim > 0) {
        // Return classes to original
        await tx.purchase.update({
          where: { id: original.id },
          data: {
            classesRemaining: { increment: classesToReclaim },
            classesAllocated: (original.classesAllocated ?? original.classesRemaining) + classesToReclaim,
            status: 'ACTIVE', // reactivate if was depleted
          },
        })
      }

      // Mark child as depleted
      await tx.purchase.update({
        where: { id: childPurchaseId },
        data: {
          classesRemaining: 0,
          classesAllocated: 0,
          status: 'DEPLETED',
        },
      })

      // Check if any other children remain in the group
      const remainingChildren = await tx.purchase.count({
        where: {
          sharedGroupId: child.sharedGroupId,
          sharedFromId: { not: null },
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          id: { not: childPurchaseId },
        },
      })

      // If no more active children, clean up the group from original
      if (remainingChildren === 0) {
        await tx.purchase.update({
          where: { id: original.id },
          data: { sharedGroupId: null },
        })
      }

      return {
        reclaimedClasses: classesToReclaim,
        originalRemaining: original.classesRemaining + classesToReclaim,
        childUserName: child.user.name || 'Sin nombre',
      }
    })

    console.log('[ADMIN] Package unshared:', {
      childPurchaseId,
      reclaimedClasses: result.reclaimedClasses,
      adminId: session.user.id,
    })

    return NextResponse.json({
      message: `${result.reclaimedClasses} clase(s) reclamadas de ${result.childUserName}`,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al reclamar clases'
    console.error('Error unsharing package:', error)

    if (error instanceof Error && (
      message.includes('no encontrada') ||
      message.includes('no es un paquete')
    )) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
