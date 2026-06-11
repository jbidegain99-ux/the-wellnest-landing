/**
 * Shared logic for marking an order as PAID and creating Purchase records.
 * Used by PayWay callback and future Wompi webhook.
 *
 * This function is IDEMPOTENT - calling it multiple times with the same orderId
 * will not create duplicate purchases.
 */

import { prisma } from '@/lib/prisma'
import { svExpiryEndOfDay } from '@/lib/utils/timezone'
import type { PaymentProvider } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { sendToFacturador } from '@/lib/facturador'
import { randomUUID } from 'crypto'

export interface MarkOrderPaidParams {
  orderId: string
  provider: PaymentProvider
  transactionData?: {
    authorizationNumber?: string
    referenceNumber?: string
    paywayNumber?: string
    transactionDate?: string
    paymentNumber?: string
    cardBrand?: string
    cardLastDigits?: string
    cardHolder?: string
    rawPayload?: Record<string, unknown>
  }
}

export interface MarkOrderPaidResult {
  success: boolean
  alreadyPaid: boolean
  purchases?: Array<{
    id: string
    packageId: string
    packageName: string
    classesRemaining: number
    expiresAt: Date
    finalPrice: number
  }>
  error?: string
}

const ALREADY_CLAIMED = 'PAYMENT_ALREADY_CLAIMED'

export async function markOrderPaidAndCreatePurchase({
  orderId,
  provider,
  transactionData,
}: MarkOrderPaidParams): Promise<MarkOrderPaidResult> {
  console.log('[PAYMENT] markOrderPaidAndCreatePurchase called:', { orderId, provider })

  try {
    // 1. Fetch order with items and check current status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            package: true,
          },
        },
        discountCodeRef: true,
      },
    })

    if (!order) {
      console.error('[PAYMENT] Order not found:', orderId)
      return { success: false, alreadyPaid: false, error: 'Order not found' }
    }

    // 2. Idempotency check - if already PAID, return early
    if (order.status === 'PAID') {
      console.log('[PAYMENT] Order already PAID, returning early (idempotent):', orderId)
      return { success: true, alreadyPaid: true }
    }

    // 3. Validate order is in PENDING status
    if (order.status !== 'PENDING') {
      console.error('[PAYMENT] Order not in PENDING status:', { orderId, status: order.status })
      return { success: false, alreadyPaid: false, error: `Order status is ${order.status}, expected PENDING` }
    }

    // 3b. Validate single-purchase packages before processing payment
    for (const item of order.items) {
      if (item.package.singlePurchaseOnly) {
        const existingPurchase = await prisma.purchase.findFirst({
          where: {
            userId: order.userId,
            packageId: item.packageId,
          },
        })

        if (existingPurchase) {
          console.error('[PAYMENT] Single-purchase package already owned:', {
            userId: order.userId,
            packageId: item.packageId,
            packageName: item.package.name,
            existingPurchaseId: existingPurchase.id,
          })
          return {
            success: false,
            alreadyPaid: false,
            error: `El usuario ya compró "${item.package.name}". Solo se puede adquirir una vez.`,
          }
        }
      }
    }

    // 4. Create all records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Atomic claim: flips PENDING -> PAID as the first statement of the
      // transaction, so concurrent callbacks (PayWay POST + browser GET,
      // retries) can never both create the Purchase set. The status checks
      // above are only a fast path — this is the authoritative gate.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      })

      if (claimed.count === 0) {
        throw new Error(ALREADY_CLAIMED)
      }

      // 4a. Create Payment Transaction record
      await tx.paymentTransaction.create({
        data: {
          orderId,
          provider,
          status: 'APPROVED',
          authorizationNumber: transactionData?.authorizationNumber,
          referenceNumber: transactionData?.referenceNumber,
          paywayNumber: transactionData?.paywayNumber,
          transactionDate: transactionData?.transactionDate,
          paymentNumber: transactionData?.paymentNumber,
          cardBrand: transactionData?.cardBrand,
          cardLastDigits: transactionData?.cardLastDigits,
          cardHolder: transactionData?.cardHolder,
          rawPayload: transactionData?.rawPayload as Prisma.InputJsonValue ?? Prisma.JsonNull,
        },
      })

      // 4b. Create Purchase records for each order item
      const purchases = []
      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          // Calculate discount per unit if applicable
          const originalPrice = item.unitPrice
          const discountPercentage = order.discountCodeRef?.percentage ?? 0
          const finalPrice = originalPrice * (1 - discountPercentage / 100)

          // Bundle branch: spawn one Purchase per child slug instead of a parent Purchase
          if (item.package.bundleChildSlugs && item.package.bundleChildSlugs.length > 0) {
            const bundleGroupId = randomUUID()
            const children = await tx.package.findMany({
              where: { slug: { in: item.package.bundleChildSlugs } },
            })
            if (children.length !== item.package.bundleChildSlugs.length) {
              const found = children.map((c) => c.slug)
              const missing = item.package.bundleChildSlugs.filter((s) => !found.includes(s))
              throw new Error(`Bundle ${item.package.slug ?? item.package.id}: missing child packages: ${missing.join(', ')}`)
            }

            // Prorate the real price across children (cent adjustment on the
            // last one) so SUM(finalPrice) of the group equals what was charged.
            // A $0 group would be invisible to finance/bank reconciliation and
            // would never get a DTE.
            const round2 = (n: number) => Math.round(n * 100) / 100
            const childOriginalShare = round2(originalPrice / children.length)
            const childFinalShare = round2(finalPrice / children.length)

            for (let c = 0; c < children.length; c++) {
              const child = children[c]
              const isLast = c === children.length - 1
              const childOriginal = isLast
                ? round2(originalPrice - childOriginalShare * (children.length - 1))
                : childOriginalShare
              const childFinal = isLast
                ? round2(finalPrice - childFinalShare * (children.length - 1))
                : childFinalShare

              const purchase = await tx.purchase.create({
                data: {
                  userId: order.userId,
                  packageId: child.id,
                  classesRemaining: child.classCount,
                  expiresAt: svExpiryEndOfDay(item.package.validityDays),
                  originalPrice: childOriginal,
                  finalPrice: childFinal,
                  discountCode: order.discountCode || null,
                  status: 'ACTIVE',
                  paymentProviderId: `${provider.toLowerCase()}_${orderId}_${item.id}_${i}_${child.slug}`,
                  bundleParentPackageId: item.package.id,
                  bundleGroupId,
                },
                include: { package: true },
              })
              purchases.push({
                id: purchase.id,
                packageId: purchase.packageId,
                packageName: purchase.package.name,
                classesRemaining: purchase.classesRemaining,
                expiresAt: purchase.expiresAt,
                finalPrice: purchase.finalPrice,
                pkg: { id: child.id, name: child.name, classCount: child.classCount },
                bundleParentPackageId: item.package.id,
              })
            }
            continue
          }

          const purchase = await tx.purchase.create({
            data: {
              userId: order.userId,
              packageId: item.packageId,
              classesRemaining: item.package.classCount,
              expiresAt: svExpiryEndOfDay(item.package.validityDays),
              originalPrice,
              finalPrice,
              discountCode: order.discountCode || null,
              status: 'ACTIVE',
              paymentProviderId: `${provider.toLowerCase()}_${orderId}_${item.id}_${i}`,
            },
            include: {
              package: true,
            },
          })

          purchases.push({
            id: purchase.id,
            packageId: purchase.packageId,
            packageName: purchase.package.name,
            classesRemaining: purchase.classesRemaining,
            expiresAt: purchase.expiresAt,
            finalPrice: purchase.finalPrice,
          })
        }
      }

      // 4c. Create PromoRedemption if discount was used
      if (order.discountCodeId && order.discountCodeRef && purchases.length > 0) {
        // Check if redemption already exists (from cart flow or duplicate)
        const existingRedemption = await tx.promoRedemption.findUnique({
          where: {
            userId_discountCodeId: {
              userId: order.userId,
              discountCodeId: order.discountCodeId,
            },
          },
        })

        if (!existingRedemption) {
          await tx.promoRedemption.create({
            data: {
              userId: order.userId,
              discountCodeId: order.discountCodeId,
              purchaseId: purchases[0].id,
              status: 'APPLIED',
            },
          })

          // Increment condicional: nunca exceder maxUses aunque dos pagos
          // concurrentes lleguen con el mismo código. Si el cupo se agotó
          // entre la creación de la orden y el pago, se respeta el precio ya
          // cobrado pero se deja registro para revisión.
          const claimed = await tx.$executeRaw`
            UPDATE "DiscountCode"
            SET "currentUses" = "currentUses" + 1
            WHERE id = ${order.discountCodeId}
              AND ("maxUses" IS NULL OR "currentUses" < "maxUses")`
          if (claimed === 0) {
            console.error('[PAYMENT] Discount maxUses exceeded at payment time (order already charged):', {
              orderId,
              discountCodeId: order.discountCodeId,
            })
          }
        }
      }

      // (The order was already marked PAID by the atomic claim above.)
      return purchases
    })

    console.log('[PAYMENT] Order marked as PAID, purchases created:', {
      orderId,
      purchaseCount: result.length,
    })

    // Trigger facturación DTE para purchases con monto > 0
    // MUST await — Vercel serverless kills the function after response is sent,
    // so fire-and-forget calls never complete.
    try {
      await triggerFacturacion(order, result)
    } catch (err) {
      console.error('[FACTURADOR] Unhandled error in triggerFacturacion:', err)
    }

    return {
      success: true,
      alreadyPaid: false,
      purchases: result,
    }
  } catch (error) {
    // Lost the atomic claim race: another invocation already processed this
    // order. Idempotent success, same as the early PAID check.
    if (error instanceof Error && error.message === ALREADY_CLAIMED) {
      console.log('[PAYMENT] Order claimed by a concurrent invocation, returning alreadyPaid:', orderId)
      return { success: true, alreadyPaid: true }
    }

    console.error('[PAYMENT] Error in markOrderPaidAndCreatePurchase:', error)
    return {
      success: false,
      alreadyPaid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Records a DENIED payment transaction.
 * Does NOT modify order status.
 */
export async function recordDeniedTransaction({
  orderId,
  provider,
  transactionData,
}: MarkOrderPaidParams): Promise<{ success: boolean; error?: string }> {
  console.log('[PAYMENT] recordDeniedTransaction called:', { orderId, provider })

  try {
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        provider,
        status: 'DENIED',
        authorizationNumber: transactionData?.authorizationNumber,
        referenceNumber: transactionData?.referenceNumber,
        paywayNumber: transactionData?.paywayNumber,
        transactionDate: transactionData?.transactionDate,
        paymentNumber: transactionData?.paymentNumber,
        cardBrand: transactionData?.cardBrand,
        cardLastDigits: transactionData?.cardLastDigits,
        cardHolder: transactionData?.cardHolder,
        rawPayload: transactionData?.rawPayload as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[PAYMENT] Error recording denied transaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// Facturación DTE (fire-and-forget)
// ========================================

interface OrderForFacturacion {
  id: string
  userId: string
  discountCodeRef?: { percentage: number } | null
  items: Array<{
    id: string
    packageId: string
    package: { id: string; name: string; classCount: number }
  }>
}

interface PurchaseForFacturacion {
  id: string
  packageId: string
  packageName: string
  classesRemaining: number
  expiresAt: Date
  finalPrice: number
  // Presentes solo en purchases hijas de un bundle: el orderItem se resuelve
  // vía el paquete padre y el DTE se emite con los datos del paquete hijo.
  pkg?: { id: string; name: string; classCount: number }
  bundleParentPackageId?: string
}

async function triggerFacturacion(
  order: OrderForFacturacion,
  purchases: PurchaseForFacturacion[]
): Promise<void> {
  const paidPurchases = purchases.filter((p) => p.finalPrice > 0)
  if (paidPurchases.length === 0) {
    console.log('[FACTURADOR] No paid purchases to invoice, skipping')
    return
  }

  // Fetch user with fiscal data
  const user = await prisma.user.findUnique({
    where: { id: order.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      documentId: true,
      documentType: true,
      fiscalAddress: true,
    },
  })

  if (!user) {
    console.error('[FACTURADOR] User not found:', order.userId)
    return
  }

  for (const purchase of paidPurchases) {
    // Las purchases hijas de un bundle no tienen orderItem propio: el item de
    // la orden apunta al paquete padre (bundleParentPackageId).
    const orderItem = order.items.find(
      (i) =>
        i.packageId === purchase.packageId ||
        (purchase.bundleParentPackageId && i.packageId === purchase.bundleParentPackageId)
    )
    if (!orderItem) {
      console.error('[FACTURADOR] No order item found for purchase, skipping invoice:', {
        purchaseId: purchase.id,
        packageId: purchase.packageId,
      })
      continue
    }

    const discountPercentage = order.discountCodeRef?.percentage ?? 0
    const originalPrice = purchase.finalPrice / (1 - discountPercentage / 100)
    const discountAmount = originalPrice - purchase.finalPrice

    try {
      const result = await sendToFacturador({
        purchaseId: purchase.id,
        orderId: order.id,
        user,
        // Para hijas de bundle, facturar con los datos del paquete hijo (el
        // orderItem.package es el bundle padre)
        pkg: purchase.pkg ?? orderItem.package,
        originalPrice: Math.round(originalPrice * 100) / 100,
        finalPrice: purchase.finalPrice,
        discountAmount: Math.round(discountAmount * 100) / 100,
      })

      if (result.success) {
        await prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            invoiceStatus: 'sent_to_facturador',
            invoiceSentAt: new Date(),
          },
        })
        console.log('[FACTURADOR] Purchase sent for invoicing:', purchase.id)
      } else {
        await prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            invoiceStatus: 'failed',
            invoiceError: result.error || 'Unknown error',
          },
        })
        console.error('[FACTURADOR] Failed to send purchase:', {
          purchaseId: purchase.id,
          error: result.error,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          invoiceStatus: 'failed',
          invoiceError: message,
        },
      }).catch((dbErr) => {
        console.error('[FACTURADOR] Failed to update purchase status:', dbErr)
      })
      console.error('[FACTURADOR] Error invoicing purchase:', {
        purchaseId: purchase.id,
        error: message,
      })
    }
  }
}
