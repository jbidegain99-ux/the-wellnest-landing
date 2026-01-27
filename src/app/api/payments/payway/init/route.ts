/**
 * POST /api/payments/payway/init
 *
 * Initializes a PayWay payment by generating encrypted payload.
 * Called from the PayWay checkout page before opening the payment modal.
 *
 * Input: { orderId }
 * Output: { amountEncrypted, responseCallbackEncrypted, ... }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { generatePaywayPayload, getPaywayConfig } from '@/lib/payments/payway'

export async function POST(request: Request) {
  console.log('[PAYWAY INIT] Request received')

  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[PAYWAY INIT] Unauthorized - no session')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // 2. Parse request body
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      console.log('[PAYWAY INIT] Missing orderId')
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 })
    }

    console.log('[PAYWAY INIT] Processing for order:', orderId)

    // 3. Fetch and validate order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            package: true,
          },
        },
      },
    })

    if (!order) {
      console.log('[PAYWAY INIT] Order not found:', orderId)
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    // 4. Verify user owns this order
    if (order.userId !== userId) {
      console.log('[PAYWAY INIT] User does not own order:', { userId, orderUserId: order.userId })
      return NextResponse.json({ error: 'No autorizado para esta orden' }, { status: 403 })
    }

    // 5. Verify order is in PENDING status
    if (order.status !== 'PENDING') {
      console.log('[PAYWAY INIT] Order not PENDING:', { orderId, status: order.status })
      return NextResponse.json(
        { error: `Orden no esta pendiente de pago (status: ${order.status})` },
        { status: 400 }
      )
    }

    // 6. Check PayWay configuration
    const config = getPaywayConfig()

    if (!config.tokenAuth || !config.tokenEncrypt || !config.retailerOwner) {
      console.error('[PAYWAY INIT] PayWay not configured properly')
      return NextResponse.json(
        { error: 'Pasarela de pago no configurada correctamente' },
        { status: 503 }
      )
    }

    // 7. Get client IP from headers
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const clientIP = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1'

    // 8. Generate encrypted payload
    const payload = generatePaywayPayload(
      orderId,
      order.total,
      clientIP,
      session.user.email || userId
    )

    console.log('[PAYWAY INIT] Payload generated successfully for order:', orderId)

    // 9. Return payload (encrypted values + merchant identifiers)
    return NextResponse.json({
      success: true,
      payload: {
        amountEncrypted: payload.amountEncrypted,
        responseCallbackEncrypted: payload.responseCallbackEncrypted,
        deniedCallbackEncrypted: payload.deniedCallbackEncrypted,
        serviceProduct: payload.serviceProduct,
        userClient: payload.userClient,
        clientIP: payload.clientIP,
        tokenAuth: payload.tokenAuth,
        retailerOwner: payload.retailerOwner,
        userOperation: payload.userOperation,
      },
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
      },
      scriptUrl: config.scriptUrl,
      env: config.env,
    })
  } catch (error) {
    console.error('[PAYWAY INIT] Error:', error)
    return NextResponse.json({ error: 'Error al inicializar pago' }, { status: 500 })
  }
}
