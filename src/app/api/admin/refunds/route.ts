import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get all refund requests (admin)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where = status ? { status: status as 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'REJECTED' } : {}

    const refundRequests = await prisma.refundRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        purchase: { include: { package: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get counts by status
    const counts = await prisma.refundRequest.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statusCounts = {
      PENDING: 0,
      PROCESSING: 0,
      REFUNDED: 0,
      REJECTED: 0,
    }

    counts.forEach((c) => {
      statusCounts[c.status as keyof typeof statusCounts] = c._count.id
    })

    return NextResponse.json({ refundRequests, statusCounts })
  } catch (error) {
    console.error('Error fetching refund requests:', error)
    return NextResponse.json(
      { error: 'Error al obtener solicitudes' },
      { status: 500 }
    )
  }
}

// POST - Process refund request (admin)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { refundId, action, notes, customAmount } = body

    if (!refundId || !action) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: { purchase: true },
    })

    if (!refundRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      )
    }

    if (refundRequest.status === 'REFUNDED' || refundRequest.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      const finalAmount = customAmount !== undefined ? customAmount : refundRequest.amount

      // Update refund request
      const updated = await prisma.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'REFUNDED',
          amount: finalAmount,
          notes: notes || null,
          refundedAt: new Date(),
          refundedBy: session.user.id,
          providerRef: `manual_${Date.now()}`, // Would be Stripe refund ID in production
        },
      })

      // Mark purchase as expired since it was refunded
      await prisma.purchase.update({
        where: { id: refundRequest.purchaseId },
        data: { status: 'EXPIRED' },
      })

      // If promo was used, void the redemption
      if (refundRequest.purchase.discountCode) {
        await prisma.promoRedemption.updateMany({
          where: { purchaseId: refundRequest.purchaseId },
          data: { status: 'REFUNDED' },
        })
      }

      console.log('[ADMIN REFUND] Refund approved:', {
        id: refundId,
        amount: finalAmount,
        approvedBy: session.user.id,
      })

      return NextResponse.json({
        success: true,
        message: `Reembolso de $${finalAmount.toFixed(2)} aprobado`,
        refundRequest: updated,
      })
    } else if (action === 'reject') {
      const updated = await prisma.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'REJECTED',
          notes: notes || 'Solicitud rechazada',
          refundedBy: session.user.id,
        },
      })

      console.log('[ADMIN REFUND] Refund rejected:', {
        id: refundId,
        rejectedBy: session.user.id,
      })

      return NextResponse.json({
        success: true,
        message: 'Solicitud de reembolso rechazada',
        refundRequest: updated,
      })
    } else if (action === 'processing') {
      const updated = await prisma.refundRequest.update({
        where: { id: refundId },
        data: {
          status: 'PROCESSING',
          notes: notes || null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Solicitud marcada como en proceso',
        refundRequest: updated,
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      { error: 'Error al procesar reembolso' },
      { status: 500 }
    )
  }
}
