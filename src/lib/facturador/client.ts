/**
 * Cliente API para Facturador Electrónico SV
 *
 * Sends purchase data to the Facturador's inbound webhook endpoint
 * which creates a DTE (electronic invoice) automatically.
 *
 * The inbound endpoint is @Public (no JWT) — secured via HMAC signature.
 */

import crypto from 'crypto'
import type { FacturadorConfig } from '@/types/facturador'

// ========================================
// Configuración
// ========================================

export function getFacturadorConfig(): FacturadorConfig | null {
  const apiUrl = process.env.FACTURADOR_SV_API_URL
  const tenantId = process.env.FACTURADOR_SV_TENANT_ID
  const webhookSecret = process.env.FACTURADOR_SV_WEBHOOK_SECRET

  if (!apiUrl || !tenantId) {
    console.warn('[FACTURADOR] Missing configuration (FACTURADOR_SV_API_URL or FACTURADOR_SV_TENANT_ID) - facturación deshabilitada')
    return null
  }

  return {
    apiUrl,
    jwtToken: '', // Not used — inbound endpoint is @Public, secured via HMAC
    tenantId,
    webhookSecret: webhookSecret || '',
  }
}

// ========================================
// Envío al Facturador
// ========================================

interface SendToFacturadorParams {
  purchaseId: string
  orderId?: string
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    documentId: string | null
    documentType: string | null
    fiscalAddress: string | null
  }
  pkg: {
    id: string
    name: string
    classCount: number
  }
  originalPrice: number
  finalPrice: number
  discountAmount: number
}

export interface SendToFacturadorResult {
  success: boolean
  dteId?: string
  codigoGeneracion?: string
  error?: string
}

/**
 * WellnestPurchasePayload — matches the Facturador's inbound controller interface.
 * This is the exact format expected by POST /api/v1/webhooks/inbound/wellnest/:tenantId
 */
interface WellnestPurchasePayload {
  userId: string
  packageId: string
  purchaseId: string
  amount: number
  currency: string
  purchaseDate: string
  expirationDate: string
  creditsTotal: number
  paymentMethod: string
  discountApplied: number
  customerData: {
    name: string
    email: string
    phone?: string
    tipoDocumento?: string
    numDocumento?: string
  }
}

/** Map Wellnest document types to MH codes */
function mapDocumentType(documentType: string | null): string | undefined {
  if (!documentType) return undefined
  switch (documentType.toUpperCase()) {
    case 'DUI': return '13'
    case 'NIT': return '36'
    case 'PASSPORT': return '37'
    default: return undefined
  }
}

export async function sendToFacturador(
  params: SendToFacturadorParams
): Promise<SendToFacturadorResult> {
  const config = getFacturadorConfig()
  if (!config) {
    return { success: false, error: 'Facturador not configured' }
  }

  const { purchaseId, orderId, user, pkg, originalPrice, finalPrice, discountAmount } = params

  // Build payload matching WellnestPurchasePayload (Facturador inbound controller)
  const payload: WellnestPurchasePayload = {
    userId: user.id,
    packageId: pkg.id,
    purchaseId: orderId ? `${orderId}_${purchaseId}` : purchaseId,
    amount: Math.round(originalPrice * 100) / 100,
    currency: 'USD',
    purchaseDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days default
    creditsTotal: pkg.classCount,
    paymentMethod: 'payway',
    discountApplied: Math.round(discountAmount * 100) / 100,
    customerData: {
      name: user.name,
      email: user.email,
      ...(user.phone ? { phone: user.phone } : {}),
      ...(mapDocumentType(user.documentType) ? { tipoDocumento: mapDocumentType(user.documentType) } : {}),
      ...(user.documentId ? { numDocumento: user.documentId } : {}),
    },
  }

  // URL with /api/v1/ prefix (global prefix in NestJS)
  const url = `${config.apiUrl}/api/v1/webhooks/inbound/wellnest/${config.tenantId}`
  const body = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
  }

  // Add HMAC signature if secret is configured
  if (config.webhookSecret) {
    headers['X-Webhook-Signature-256'] = 'sha256=' + crypto
      .createHmac('sha256', config.webhookSecret)
      .update(body)
      .digest('hex')
  }

  console.log('[FACTURADOR] Sending to Facturador SV:', {
    url,
    purchaseId: payload.purchaseId,
    userId: user.id,
    amount: payload.amount,
    discount: payload.discountApplied,
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const responseBody = await response.text().catch(() => 'No body')
      console.error('[FACTURADOR] API error:', {
        status: response.status,
        body: responseBody.substring(0, 500),
      })
      return { success: false, error: `HTTP ${response.status}: ${responseBody.substring(0, 200)}` }
    }

    const result = await response.json().catch(() => ({})) as {
      data?: { dteId?: string; codigoGeneracion?: string; message?: string }
    }

    console.log('[FACTURADOR] DTE created:', {
      purchaseId: payload.purchaseId,
      dteId: result.data?.dteId,
      codigoGeneracion: result.data?.codigoGeneracion,
    })

    return {
      success: true,
      dteId: result.data?.dteId,
      codigoGeneracion: result.data?.codigoGeneracion,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[FACTURADOR] Failed to send:', { purchaseId, error: message })
    return { success: false, error: message }
  }
}

// ========================================
// Verificación de firma HMAC (webhooks entrantes)
// ========================================

const MAX_TIMESTAMP_AGE_SECONDS = 300 // 5 minutos

export function verifyFacturadorSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string
): { valid: boolean; error?: string } {
  if (!signature || !timestamp || !secret) {
    return { valid: false, error: 'Missing signature, timestamp, or secret' }
  }

  // Protección contra replay attacks
  const timestampNum = parseInt(timestamp, 10)
  if (isNaN(timestampNum)) {
    return { valid: false, error: 'Invalid timestamp format' }
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNum)
  if (ageSeconds > MAX_TIMESTAMP_AGE_SECONDS) {
    return { valid: false, error: `Timestamp too old: ${Math.round(ageSeconds)}s` }
  }

  // Verificar HMAC SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const receivedSignature = signature.replace('sha256=', '')

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )
    return { valid: isValid }
  } catch {
    return { valid: false, error: 'Signature comparison failed' }
  }
}
