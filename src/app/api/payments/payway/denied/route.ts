/**
 * POST /api/payments/payway/denied
 *
 * Callback endpoint called by PayWay when payment is denied/cancelled.
 * Records the denied transaction and redirects back to payment page.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordDeniedTransaction } from '@/lib/payments/markOrderPaid'
import { parsePaywayCallback, sanitizePaywayPayload } from '@/lib/payments/payway'

export async function POST(request: Request) {
  console.log('[PAYWAY DENIED] Received denied callback')

  try {
    // 1. Get orderId from query string
    const url = new URL(request.url)
    const orderId = url.searchParams.get('oid')

    if (!orderId) {
      console.error('[PAYWAY DENIED] Missing orderId in query string')
      return NextResponse.redirect(new URL('/checkout?error=missing_order', request.url))
    }

    console.log('[PAYWAY DENIED] Processing for order:', orderId)

    // 2. Parse form data from PayWay
    let formData: Record<string, string> = {}

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      params.forEach((value, key) => {
        formData[key] = value
      })
    } else if (contentType.includes('application/json')) {
      formData = await request.json()
    } else if (contentType.includes('multipart/form-data')) {
      const data = await request.formData()
      data.forEach((value, key) => {
        if (typeof value === 'string') {
          formData[key] = value
        }
      })
    }

    console.log('[PAYWAY DENIED] Received data keys:', Object.keys(formData))

    // 3. Parse callback data
    const callbackData = parsePaywayCallback(url.searchParams, formData)

    // 4. Verify order exists and is still PENDING
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      console.error('[PAYWAY DENIED] Order not found:', orderId)
      return NextResponse.redirect(new URL('/checkout?error=order_not_found', request.url))
    }

    // If order is already PAID, redirect to success (unusual but handle it)
    if (order.status === 'PAID') {
      console.log('[PAYWAY DENIED] Order already PAID, redirecting to success')
      return NextResponse.redirect(new URL(`/checkout/success/${orderId}`, request.url))
    }

    // 5. Record denied transaction if we have data
    if (callbackData) {
      await recordDeniedTransaction({
        orderId,
        provider: 'PAYWAY',
        transactionData: {
          authorizationNumber: callbackData.authorizationNumber,
          referenceNumber: callbackData.referenceNumber,
          paywayNumber: callbackData.paywayNumber,
          transactionDate: callbackData.transactionDate,
          paymentNumber: callbackData.paymentNumber,
          cardBrand: callbackData.cardBrand,
          cardLastDigits: callbackData.cardLastDigits,
          cardHolder: callbackData.cardHolder,
          rawPayload: sanitizePaywayPayload(formData),
        },
      })
    }

    console.log('[PAYWAY DENIED] Denied transaction recorded, redirecting to payment page')

    // 6. Redirect back to payment page with denied status
    return NextResponse.redirect(
      new URL(`/checkout/payway/${orderId}?status=denied`, request.url)
    )
  } catch (error) {
    console.error('[PAYWAY DENIED] Error processing denied callback:', error)

    const url = new URL(request.url)
    const orderId = url.searchParams.get('oid')

    if (orderId) {
      return NextResponse.redirect(
        new URL(`/checkout/payway/${orderId}?status=error`, request.url)
      )
    }

    return NextResponse.redirect(new URL('/checkout?error=server_error', request.url))
  }
}

// Handle GET requests
export async function GET(request: Request) {
  console.log('[PAYWAY DENIED] GET request received')

  const url = new URL(request.url)
  const orderId = url.searchParams.get('oid')

  if (!orderId) {
    return NextResponse.redirect(new URL('/checkout?error=missing_order', request.url))
  }

  // Check order status
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (order?.status === 'PAID') {
    return NextResponse.redirect(new URL(`/checkout/success/${orderId}`, request.url))
  }

  // Redirect to payment page with denied status
  return NextResponse.redirect(
    new URL(`/checkout/payway/${orderId}?status=denied`, request.url)
  )
}
