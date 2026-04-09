import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendToFacturador } from '@/lib/facturador'
import { z } from 'zod'

/**
 * Payment source for admin-assigned packages. Determines how the Purchase
 * is recorded financially:
 *
 *   POS             → customer paid at the physical Cuscatlán terminal.
 *                     Charges the package price, goes into "Pago por POS"
 *                     in the finanzas dashboard.
 *   MANUAL_TRANSFER → customer paid by bank transfer or cash. Charges the
 *                     package price, goes into "Transferencia / Efectivo".
 *   GIFT            → courtesy / gift. finalPrice = 0, excluded from the
 *                     finanzas dashboard entirely.
 */
const PaymentSourceEnum = z.enum(['POS', 'MANUAL_TRANSFER', 'GIFT'])
type PaymentSource = z.infer<typeof PaymentSourceEnum>

const assignPackageSchema = z.object({
  packageId: z.string().min(1, 'Se requiere el ID del paquete'),
  classCount: z.number().optional(), // If not provided, use package default
  paymentSource: PaymentSourceEnum,
  sendInvoice: z.boolean().optional().default(true), // Generate DTE via Facturador SV
})

/**
 * Maps a PaymentSource to the Purchase.paymentProviderId string.
 * These prefixes are recognized by classifyPayment() in src/lib/finance/calculate.ts.
 */
function providerIdFor(source: PaymentSource): string {
  switch (source) {
    case 'POS':
      return 'pos_manual'
    case 'MANUAL_TRANSFER':
      return 'manual_payment'
    case 'GIFT':
      return 'gift_manual'
  }
}

// POST - assign a package to a user
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
    const validation = assignPackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { packageId, classCount, paymentSource, sendInvoice } = validation.data

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verify package exists
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    // Determine financial fields from payment source
    const isRevenue = paymentSource !== 'GIFT'
    const finalPrice = isRevenue ? pkg.price : 0
    const paymentProviderId = providerIdFor(paymentSource)

    // Invoicing only applies to revenue-generating sources with a price
    const shouldInvoice = sendInvoice && isRevenue && pkg.price > 0

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pkg.validityDays)

    // Create the purchase (assign package to user)
    const purchase = await prisma.purchase.create({
      data: {
        userId,
        packageId,
        classesRemaining: classCount || pkg.classCount,
        originalPrice: pkg.price,
        finalPrice,
        paymentProviderId,
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        package: true,
      },
    })

    console.log('[ADMIN] Package assigned:', {
      userId,
      packageId,
      purchaseId: purchase.id,
      paymentSource,
      finalPrice,
      paymentProviderId,
      classesRemaining: purchase.classesRemaining,
      expiresAt: purchase.expiresAt,
      adminId: session.user.id,
    })

    // Send to Facturador SV if requested and the purchase represents revenue
    let invoiceSent = false
    let invoiceError: string | null = null

    if (shouldInvoice) {
      try {
        const result = await sendToFacturador({
          purchaseId: purchase.id,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            documentId: user.documentId,
            documentType: user.documentType,
            fiscalAddress: user.fiscalAddress,
          },
          pkg: { id: pkg.id, name: pkg.name, classCount: pkg.classCount },
          originalPrice: pkg.price,
          finalPrice: pkg.price,
          discountAmount: 0,
        })

        if (result.success) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: {
              invoiceStatus: 'sent_to_facturador',
              invoiceSentAt: new Date(),
            },
          })
          invoiceSent = true
          console.log('[ADMIN] Invoice sent for assigned package:', {
            purchaseId: purchase.id,
            paymentSource,
          })
        } else {
          invoiceError = result.error || 'Error desconocido'
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: {
              invoiceStatus: 'failed',
              invoiceError,
            },
          })
          console.error('[ADMIN] Invoice failed for assigned package:', {
            purchaseId: purchase.id,
            error: invoiceError,
          })
        }
      } catch (err) {
        invoiceError = err instanceof Error ? err.message : 'Error desconocido'
        console.error('[ADMIN] Invoice exception:', invoiceError)
      }
    }

    // Build human-friendly message
    const sourceLabel =
      paymentSource === 'POS'
        ? 'pago por POS'
        : paymentSource === 'MANUAL_TRANSFER'
        ? 'transferencia / efectivo'
        : 'cortesía'

    let message = `Paquete "${pkg.name}" asignado como ${sourceLabel}`
    if (shouldInvoice) {
      message += invoiceSent
        ? ' — factura enviada'
        : ` — la factura falló: ${invoiceError}`
    }

    return NextResponse.json(
      {
        message,
        paymentSource,
        invoiceSent,
        invoiceError,
        purchase: {
          id: purchase.id,
          packageName: purchase.package.name,
          classesRemaining: purchase.classesRemaining,
          finalPrice: purchase.finalPrice,
          expiresAt: purchase.expiresAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error assigning package:', error)
    return NextResponse.json(
      { error: 'Error al asignar el paquete' },
      { status: 500 }
    )
  }
}
