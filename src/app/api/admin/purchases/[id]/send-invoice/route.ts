import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendToFacturador } from '@/lib/facturador'

/**
 * POST /api/admin/purchases/:id/send-invoice
 *
 * Sends a purchase to the Facturador SV for electronic invoicing.
 * Uses the package's catalog price (not finalPrice, which is $0 for admin-assigned).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: purchaseId } = await params

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            documentId: true,
            documentType: true,
            fiscalAddress: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            classCount: true,
            price: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    if (
      purchase.invoiceStatus === 'sent_to_facturador' ||
      purchase.invoiceStatus === 'completed' ||
      purchase.invoiceStatus === 'processing'
    ) {
      return NextResponse.json(
        { error: `Esta compra ya fue enviada a facturación (estado: ${purchase.invoiceStatus})` },
        { status: 400 }
      )
    }

    // Facturar lo realmente cobrado cuando existe; el precio de catálogo es
    // solo el fallback para asignaciones admin con finalPrice = 0 (facturar
    // catálogo ignorando descuentos generaba DTEs por montos no cobrados)
    const invoicePrice =
      purchase.finalPrice > 0 ? purchase.finalPrice : purchase.package.price
    const originalPrice =
      purchase.finalPrice > 0 && purchase.originalPrice > 0
        ? purchase.originalPrice
        : invoicePrice
    const discountAmount = Math.max(0, Math.round((originalPrice - invoicePrice) * 100) / 100)

    if (invoicePrice <= 0) {
      return NextResponse.json(
        { error: 'No se puede facturar un paquete con precio $0' },
        { status: 400 }
      )
    }

    // Claim atómico del estado: dos clics simultáneos no generan doble DTE
    const claimed = await prisma.purchase.updateMany({
      where: {
        id: purchaseId,
        OR: [
          { invoiceStatus: null },
          { invoiceStatus: { in: ['failed', 'facturador_error', 'pending'] } },
        ],
      },
      data: { invoiceStatus: 'processing' },
    })
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'Esta compra ya está siendo facturada' },
        { status: 409 }
      )
    }

    // Misma referencia que el envio original (orderId_purchaseId) para que
    // el facturador pueda deduplicar reintentos
    const providerMatch = /^(?:payway|wompi)_([^_]+)_/.exec(purchase.paymentProviderId ?? '')
    const result = await sendToFacturador({
      purchaseId: purchase.id,
      orderId: providerMatch?.[1],
      user: purchase.user,
      pkg: purchase.package,
      originalPrice,
      finalPrice: invoicePrice,
      discountAmount,
    })

    if (result.success) {
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          invoiceStatus: 'sent_to_facturador',
          invoiceSentAt: new Date(),
        },
      })

      console.log('[ADMIN] Invoice sent for purchase:', {
        purchaseId,
        userId: purchase.userId,
        packageName: purchase.package.name,
        amount: invoicePrice,
        adminId: session.user.id,
      })

      return NextResponse.json({
        success: true,
        message: `Factura enviada para "${purchase.package.name}" — $${invoicePrice.toFixed(2)}`,
      })
    }

    await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        invoiceStatus: 'failed',
        invoiceError: result.error || 'Unknown error',
      },
    })

    return NextResponse.json(
      { error: `Error al enviar factura: ${result.error}` },
      { status: 502 }
    )
  } catch (error) {
    console.error('[ADMIN] Error sending invoice:', error)
    // Liberar el claim 'processing' para permitir reintento
    try {
      const { id } = await params
      await prisma.purchase.updateMany({
        where: { id, invoiceStatus: 'processing' },
        data: { invoiceStatus: 'failed', invoiceError: 'Error interno al enviar' },
      })
    } catch {
      // best-effort
    }
    return NextResponse.json(
      { error: 'Error interno al enviar factura' },
      { status: 500 }
    )
  }
}
