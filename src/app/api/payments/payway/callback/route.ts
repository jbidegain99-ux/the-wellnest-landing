/**
 * POST /api/payments/payway/callback
 *
 * Callback endpoint called by PayWay after successful payment.
 * Receives form data (x-www-form-urlencoded) with transaction details.
 *
 * Query params: ?oid=<orderId>
 * Body: pwoAuthorizationNumber, pwoReferenceNumber, etc.
 *
 * On success: Marks order as PAID, creates Purchase, redirects to success page.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { markOrderPaidAndCreatePurchase } from '@/lib/payments/markOrderPaid'
import { parsePaywayCallback, sanitizePaywayPayload } from '@/lib/payments/payway'

export async function POST(request: Request) {
  console.log('[PAYWAY CALLBACK] Received callback')

  try {
    const url = new URL(request.url)

    // 1. Parse form data from PayWay first (we need it to extract orderId)
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

    console.log('[PAYWAY CALLBACK] Received data keys:', Object.keys(formData))
    console.log('[PAYWAY CALLBACK] Form data:', formData)

    // 2. Get orderId from multiple sources
    let orderId = url.searchParams.get('oid')

    // Check if oid is in the form data body (PayWay sends it here)
    if (!orderId && formData.oid) {
      orderId = formData.oid
      console.log('[PAYWAY CALLBACK] Found orderId in form data body:', orderId)
    }

    // Try to extract from serviceProduct if not found yet
    // serviceProduct format: "wellnest_order_<orderId>"
    if (!orderId && formData.serviceProduct) {
      const match = formData.serviceProduct.match(/wellnest_order_(.+)/)
      if (match) {
        orderId = match[1]
        console.log('[PAYWAY CALLBACK] Extracted orderId from serviceProduct:', orderId)
      }
    }

    // Also try pwoServiceProduct (PayWay might use this name)
    if (!orderId && formData.pwoServiceProduct) {
      const match = formData.pwoServiceProduct.match(/wellnest_order_(.+)/)
      if (match) {
        orderId = match[1]
        console.log('[PAYWAY CALLBACK] Extracted orderId from pwoServiceProduct:', orderId)
      }
    }

    if (!orderId) {
      console.error('[PAYWAY CALLBACK] Could not find orderId in query or body')
      console.error('[PAYWAY CALLBACK] Available fields:', Object.keys(formData))
      return NextResponse.json({
        error: 'Missing orderId',
        availableFields: Object.keys(formData)
      }, { status: 400 })
    }

    console.log('[PAYWAY CALLBACK] Processing for order:', orderId)

    // 3. Parse callback data
    const callbackData = parsePaywayCallback(url.searchParams, formData)

    // We already have orderId, so update callbackData
    if (callbackData) {
      callbackData.orderId = orderId
    }

    // 4. Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      console.error('[PAYWAY CALLBACK] Order not found:', orderId)
      // Still redirect to avoid exposing order existence
      // Use 303 status to force GET request
      return NextResponse.redirect(new URL(`/checkout/payway/${orderId}?status=error`, request.url), 303)
    }

    // 5. Check if order is already PAID (idempotency)
    if (order.status === 'PAID') {
      console.log('[PAYWAY CALLBACK] Order already PAID, redirecting to success:', orderId)
      // Redirect to public success page (not protected by auth)
      // Use 303 status to force GET request (307 would preserve POST method)
      return NextResponse.redirect(new URL(`/payment/success?oid=${orderId}`, request.url), 303)
    }

    // 6. Check if order is in PENDING status
    if (order.status !== 'PENDING') {
      console.error('[PAYWAY CALLBACK] Order not PENDING:', { orderId, status: order.status })
      return NextResponse.redirect(
        new URL(`/checkout/payway/${orderId}?status=error&reason=invalid_status`, request.url),
        303
      )
    }

    // 7. Mark order as paid and create purchases
    const result = await markOrderPaidAndCreatePurchase({
      orderId,
      provider: 'PAYWAY',
      transactionData: {
        authorizationNumber: callbackData?.authorizationNumber,
        referenceNumber: callbackData?.referenceNumber,
        paywayNumber: callbackData?.paywayNumber,
        transactionDate: callbackData?.transactionDate,
        paymentNumber: callbackData?.paymentNumber,
        cardBrand: callbackData?.cardBrand,
        cardLastDigits: callbackData?.cardLastDigits,
        cardHolder: callbackData?.cardHolder,
        rawPayload: sanitizePaywayPayload(formData),
      },
    })

    if (!result.success) {
      console.error('[PAYWAY CALLBACK] Failed to process payment:', result.error)
      return NextResponse.redirect(
        new URL(`/checkout/payway/${orderId}?status=error&reason=processing_failed`, request.url),
        303
      )
    }

    if (result.alreadyPaid) {
      console.log('[PAYWAY CALLBACK] Order was already processed (race condition), redirecting')
    }

    console.log('[PAYWAY CALLBACK] Payment processed successfully:', {
      orderId,
      purchaseCount: result.purchases?.length,
    })

    // 8. Redirect to public success page (not protected by auth)
    // This avoids session cookie issues with cross-site redirects
    // Use 303 status to force GET request (307 would preserve POST method)
    return NextResponse.redirect(new URL(`/payment/success?oid=${orderId}`, request.url), 303)
  } catch (error) {
    console.error('[PAYWAY CALLBACK] Error processing callback:', error)

    // Try to extract orderId for redirect
    const url = new URL(request.url)
    const orderId = url.searchParams.get('oid')

    if (orderId) {
      return NextResponse.redirect(
        new URL(`/checkout/payway/${orderId}?status=error&reason=server_error`, request.url),
        303
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also handle GET in case PayWay sends a GET redirect
export async function GET(request: Request) {
  console.log('[PAYWAY CALLBACK] GET request received, converting to POST logic')

  const url = new URL(request.url)
  const orderId = url.searchParams.get('oid')

  if (!orderId) {
    return NextResponse.redirect(new URL('/checkout?error=missing_order', request.url))
  }

  // Check if there are transaction params in the URL (some gateways do this)
  const authNumber = url.searchParams.get('pwoAuthorizationNumber')

  if (authNumber) {
    // PayWay sent data via GET params - process it
    const formData: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      if (key !== 'oid') {
        formData[key] = value
      }
    })

    const callbackData = parsePaywayCallback(url.searchParams, formData)

    if (callbackData) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      })

      if (order && order.status === 'PENDING') {
        const result = await markOrderPaidAndCreatePurchase({
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

        if (result.success) {
          return NextResponse.redirect(new URL(`/payment/success?oid=${orderId}`, request.url))
        }
      }
    }
  }

  // Check order status for appropriate redirect
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (order?.status === 'PAID') {
    return NextResponse.redirect(new URL(`/payment/success?oid=${orderId}`, request.url))
  }

  // Default: redirect back to payment page
  return NextResponse.redirect(new URL(`/checkout/payway/${orderId}`, request.url))
}
