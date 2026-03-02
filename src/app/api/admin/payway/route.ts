/**
 * Health check endpoint para la integración con PayWay.
 * Solo accesible por ADMIN.
 *
 * GET /api/admin/payway — Muestra estado de configuración de producción.
 * GET /api/admin/payway?test=1 — Muestra encriptación de prueba para validar con PayWay.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPaywayConfig, encryptPaywayValue } from '@/lib/payments/payway'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getPaywayConfig()
  const url = new URL(request.url)
  const showTest = url.searchParams.get('test') === '1'

  const response: Record<string, unknown> = {
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
    tokenEncryptLength: config.tokenEncrypt?.length || 0,
    keyBytesUsed: config.tokenEncrypt ? config.tokenEncrypt.slice(0, 32).length : 0,
    callbackUrls: {
      success: `${config.callbackBaseUrl}/api/payments/payway/callback?oid=<orderId>`,
      denied: `${config.callbackBaseUrl}/api/payments/payway/denied?oid=<orderId>`,
    },
    sdkParameterNames: {
      token: 'tokenAuth (pwoToken)',
      amount: 'amountEncrypted (pwoAmount)',
      responseCallback: 'responseCallbackEncrypted (pwoResponseCallBack)',
      responseCallbackForDenied: 'deniedCallbackEncrypted (pwoResponseCallbackForDenied)',
    },
  }

  // Test encryption with a known value so PayWay can verify
  if (showTest && config.tokenEncrypt) {
    const testAmount = '10.00'
    const testCallback = 'https://wellneststudio.net/api/payments/payway/callback?oid=test123'

    response.encryptionTest = {
      plainAmount: testAmount,
      encryptedAmount: encryptPaywayValue(testAmount, config.tokenEncrypt),
      plainCallback: testCallback,
      encryptedCallback: encryptPaywayValue(testCallback, config.tokenEncrypt),
      method: 'AES-256-CBC',
      iv: 'fedcba9876543210',
      keyDerivation: 'First 32 UTF-8 characters of PAYWAY_TOKEN_ENCRYPT',
      keyFirst32Chars: config.tokenEncrypt.slice(0, 32),
    }
  }

  return NextResponse.json(response)
}
