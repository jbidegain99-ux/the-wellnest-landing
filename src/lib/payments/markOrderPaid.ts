/**
 * Shared logic for marking an order as PAID and creating Purchase records.
 * Used by PayWay callback and future Wompi webhook.
 *
 * This function is IDEMPOTENT - calling it multiple times with the same orderId
 * will not create duplicate purchases.
 */

import { prisma } from '@/lib/prisma'
import { addDays } from 'date-fns'
import type { PaymentProvider } from '@prisma/client'
import { Prisma } from '@prisma/client'

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

    // 4. Create all records in a transaction
    const result = await prisma.$transaction(async (tx) => {
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

          const purchase = await tx.purchase.create({
            data: {
              userId: order.userId,
              packageId: item.packageId,
              classesRemaining: item.package.classCount,
              expiresAt: addDays(new Date(), item.package.validityDays),
              originalPrice,
              finalPrice,
              discountCode: order.discountCode || null,
              status: 'ACTIVE',
              stripePaymentId: `${provider.toLowerCase()}_${orderId}_${item.id}_${i}`,
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

          // Increment discount code usage
          await tx.discountCode.update({
            where: { id: order.discountCodeId },
            data: { currentUses: { increment: 1 } },
          })
        }
      }

      // 4d. Mark order as PAID
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      return purchases
    })

    console.log('[PAYMENT] Order marked as PAID, purchases created:', {
      orderId,
      purchaseCount: result.length,
    })

    return {
      success: true,
      alreadyPaid: false,
      purchases: result,
    }
  } catch (error) {
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
