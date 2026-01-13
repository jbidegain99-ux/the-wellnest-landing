import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Get cancellation policy hours from settings (or default)
async function getCancellationHours(): Promise<number> {
  const setting = await prisma.siteSettings.findUnique({
    where: { key: 'cancellationHours' },
  })
  return setting ? parseInt(setting.value, 10) : 4
}

// Check if refund is within policy
function isWithinPolicy(purchaseDate: Date, cancellationHours: number): boolean {
  const now = new Date()
  const hoursSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60)
  return hoursSincePurchase <= cancellationHours
}

// POST - Create refund request
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { purchaseId, reason } = body

    if (!purchaseId) {
      return NextResponse.json(
        { error: 'ID de compra requerido' },
        { status: 400 }
      )
    }

    // Get purchase with details
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { package: true },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Compra no encontrada' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (purchase.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Check if there's already a pending refund request
    const existingRequest = await prisma.refundRequest.findFirst({
      where: {
        purchaseId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Ya existe una solicitud de reembolso pendiente para esta compra' },
        { status: 400 }
      )
    }

    // Get cancellation policy
    const cancellationHours = await getCancellationHours()
    const eligible = isWithinPolicy(purchase.createdAt, cancellationHours)

    // Calculate refund amount based on classes used
    const classesUsed = purchase.package.classCount - purchase.classesRemaining
    const percentageUsed = classesUsed / purchase.package.classCount
    let refundAmount = purchase.finalPrice

    // If some classes were used, calculate proportional refund
    if (classesUsed > 0) {
      refundAmount = purchase.finalPrice * (1 - percentageUsed)
    }

    // If outside policy, no automatic refund
    if (!eligible) {
      refundAmount = 0
    }

    // Create refund request
    const refundRequest = await prisma.refundRequest.create({
      data: {
        userId,
        purchaseId,
        amount: refundAmount,
        eligible,
        status: 'PENDING',
        reason: reason || (eligible ? 'within_policy' : 'outside_policy'),
        policySnapshot: JSON.stringify({
          cancellationHours,
          classesUsed,
          classesTotal: purchase.package.classCount,
          originalPrice: purchase.finalPrice,
          calculatedRefund: refundAmount,
        }),
      },
      include: {
        purchase: { include: { package: true } },
      },
    })

    console.log('[REFUND API] Refund request created:', {
      id: refundRequest.id,
      amount: refundAmount,
      eligible,
    })

    return NextResponse.json({
      success: true,
      refundRequest: {
        id: refundRequest.id,
        amount: refundAmount,
        eligible,
        status: refundRequest.status,
        message: eligible
          ? `Solicitud de reembolso creada por $${refundAmount.toFixed(2)}`
          : 'Solicitud de reembolso creada. Será revisada por el equipo.',
      },
    })
  } catch (error) {
    console.error('Error creating refund request:', error)
    return NextResponse.json(
      { error: 'Error al crear solicitud de reembolso' },
      { status: 500 }
    )
  }
}

// GET - Get user's refund requests
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const refundRequests = await prisma.refundRequest.findMany({
      where: { userId: session.user.id },
      include: {
        purchase: {
          include: { package: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ refundRequests })
  } catch (error) {
    console.error('Error fetching refund requests:', error)
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    )
  }
}
