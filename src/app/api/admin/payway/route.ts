/**
 * Health check endpoint para la integración con PayWay.
 * Solo accesible por ADMIN.
 *
 * GET /api/admin/payway — Muestra estado de configuración de producción.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaywayConfig } from '@/lib/payments/payway'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getPaywayConfig()

  return NextResponse.json({
    environment: config.env,
    baseUrl: config.baseUrl,
    scriptUrl: config.scriptUrl,
    retailerOwner: config.retailerOwner,
    userOperation: config.userOperation,
    callbackBaseUrl: config.callbackBaseUrl,
    hasTokenAuth: !!config.tokenAuth,
    tokenAuthPreview: config.tokenAuth ? `${config.tokenAuth.substring(0, 10)}...` : null,
    hasTokenEncrypt: !!config.tokenEncrypt,
    tokenEncryptPreview: config.tokenEncrypt ? `${config.tokenEncrypt.substring(0, 10)}...` : null,
    callbackUrls: {
      success: `${config.callbackBaseUrl}/api/payments/payway/callback?oid=<orderId>`,
      denied: `${config.callbackBaseUrl}/api/payments/payway/denied?oid=<orderId>`,
    },
  })
}
