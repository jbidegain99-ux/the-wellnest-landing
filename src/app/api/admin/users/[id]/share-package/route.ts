import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const allocationSchema = z.object({
  userId: z.string().min(1),
  classCount: z.number().int().positive(),
})

const sharePackageSchema = z.object({
  purchaseId: z.string().min(1, 'Se requiere el ID de la compra'),
  allocations: z.array(allocationSchema).min(1, 'Se requiere al menos una asignación'),
})

// POST - share classes from a purchase to other users
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: userId } = await params
    const body = await request.json()
    const validation = sharePackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { purchaseId, allocations } = validation.data

    // Validate no duplicate target users
    const targetUserIds = allocations.map((a) => a.userId)
    if (new Set(targetUserIds).size !== targetUserIds.length) {
      return NextResponse.json(
        { error: 'No se puede asignar clases al mismo usuario más de una vez' },
        { status: 400 }
      )
    }

    // Cannot share with the source user
    if (targetUserIds.includes(userId)) {
      return NextResponse.json(
        { error: 'No se puede compartir clases con el mismo usuario origen' },
        { status: 400 }
      )
    }

    const totalToAllocate = allocations.reduce((sum, a) => sum + a.classCount, 0)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and validate source purchase
      const source = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { package: true },
      })

      if (!source || source.userId !== userId) {
        throw new Error('Compra no encontrada para este usuario')
      }

      if (source.status !== 'ACTIVE') {
        throw new Error('La compra no está activa')
      }

      if (new Date(source.expiresAt) <= new Date()) {
        throw new Error('La compra está expirada')
      }

      if (source.package.singlePurchaseOnly) {
        throw new Error('Este tipo de paquete no se puede compartir')
      }

      if (source.classesRemaining < totalToAllocate) {
        throw new Error(
          `Clases insuficientes. Disponibles: ${source.classesRemaining}, solicitadas: ${totalToAllocate}`
        )
      }

      // 2. Verify all target users exist
      const targetUsers = await tx.user.findMany({
        where: { id: { in: targetUserIds } },
        select: { id: true, name: true },
      })

      if (targetUsers.length !== targetUserIds.length) {
        throw new Error('Uno o más usuarios destinatarios no existen')
      }

      // 3. Generate or reuse sharedGroupId
      const sharedGroupId = source.sharedGroupId || crypto.randomUUID()

      // 4. Set classesAllocated on source if not already set
      const sourceClassesAllocated = source.classesAllocated ?? source.classesRemaining

      // 5. Decrement source and update shared fields
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          classesRemaining: { decrement: totalToAllocate },
          sharedGroupId,
          classesAllocated: sourceClassesAllocated,
        },
      })

      // 6. Create child purchases
      const createdPurchases = []
      for (const allocation of allocations) {
        const child = await tx.purchase.create({
          data: {
            userId: allocation.userId,
            packageId: source.packageId,
            classesRemaining: allocation.classCount,
            classesAllocated: allocation.classCount,
            expiresAt: source.expiresAt,
            originalPrice: 0,
            finalPrice: 0,
            status: 'ACTIVE',
            sharedGroupId,
            sharedFromId: source.id,
          },
        })
        const targetUser = targetUsers.find((u) => u.id === allocation.userId)
        createdPurchases.push({
          id: child.id,
          userId: allocation.userId,
          userName: targetUser?.name || 'Sin nombre',
          classesAllocated: allocation.classCount,
        })
      }

      return {
        sharedGroupId,
        sourceRemainingAfter: source.classesRemaining - totalToAllocate,
        allocations: createdPurchases,
      }
    })

    console.log('[ADMIN] Package shared:', {
      sourceUserId: userId,
      purchaseId,
      sharedGroupId: result.sharedGroupId,
      allocations: result.allocations,
      adminId: session.user.id,
    })

    return NextResponse.json({
      message: 'Paquete compartido exitosamente',
      ...result,
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al compartir el paquete'
    console.error('Error sharing package:', error)

    if (error instanceof Error && (
      message.includes('no encontrada') ||
      message.includes('no está activa') ||
      message.includes('expirada') ||
      message.includes('no se puede compartir') ||
      message.includes('insuficientes') ||
      message.includes('no existen') ||
      message.includes('mismo usuario')
    )) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
