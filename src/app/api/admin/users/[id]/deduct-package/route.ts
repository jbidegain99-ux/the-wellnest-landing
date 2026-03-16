import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const deductPackageSchema = z.object({
  purchaseId: z.string().min(1, 'Se requiere el ID de la compra'),
  quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  reason: z.string().min(1, 'Se requiere un motivo para la deducción'),
})

// POST - deduct classes from a user's purchase
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
    const validation = deductPackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { purchaseId, quantity, reason } = validation.data

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Fetch the specific purchase
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        package: { select: { name: true } },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      )
    }

    // Verify the purchase belongs to the user
    if (purchase.userId !== userId) {
      return NextResponse.json(
        { error: 'La compra no pertenece a este usuario' },
        { status: 400 }
      )
    }

    // Check sufficient balance
    if (purchase.classesRemaining < quantity) {
      return NextResponse.json(
        {
          error: `Balance insuficiente. El usuario tiene ${purchase.classesRemaining} clase(s) disponible(s), pero se intentan deducir ${quantity}.`,
        },
        { status: 400 }
      )
    }

    const previousBalance = purchase.classesRemaining
    const newBalance = previousBalance - quantity

    // Update the purchase
    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        classesRemaining: newBalance,
        // If balance reaches 0, mark as depleted
        ...(newBalance === 0 ? { status: 'DEPLETED' } : {}),
      },
      include: {
        package: { select: { name: true } },
      },
    })

    // Log the deduction
    const now = new Date()
    console.log('[ADMIN] Package deduction:', {
      timestamp: now.toISOString(),
      userId,
      userEmail: user.email,
      purchaseId,
      packageName: purchase.package.name,
      quantityDeducted: quantity,
      previousBalance,
      newBalance,
      reason,
      adminId: session.user.id,
      adminEmail: session.user.email,
    })

    return NextResponse.json({
      message: `Se dedujeron ${quantity} clase(s) de "${purchase.package.name}"`,
      deduction: {
        purchaseId,
        packageName: updatedPurchase.package.name,
        previousBalance,
        newBalance,
        quantityDeducted: quantity,
        reason,
        timestamp: now.toISOString(),
        status: updatedPurchase.status,
      },
    })
  } catch (error) {
    console.error('Error deducting package:', error)
    return NextResponse.json(
      { error: 'Error al deducir del paquete' },
      { status: 500 }
    )
  }
}
