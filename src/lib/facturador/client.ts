/**
 * Cliente API para Facturador Electrónico SV
 *
 * Maneja el envío de datos de compra al Facturador y la verificación
 * de firmas HMAC en webhooks de respuesta.
 */

import crypto from 'crypto'
import type {
  FacturadorConfig,
  FacturadorOutboundPayload,
  FacturadorClienteData,
} from '@/types/facturador'

// ========================================
// Configuración
// ========================================

export function getFacturadorConfig(): FacturadorConfig | null {
  const apiUrl = process.env.FACTURADOR_SV_API_URL
  const jwtToken = process.env.FACTURADOR_SV_JWT_TOKEN
  const tenantId = process.env.FACTURADOR_SV_TENANT_ID
  const webhookSecret = process.env.FACTURADOR_SV_WEBHOOK_SECRET

  if (!apiUrl || !jwtToken || !tenantId) {
    console.warn('[FACTURADOR] Missing configuration - facturación deshabilitada')
    return null
  }

  return { apiUrl, jwtToken, tenantId, webhookSecret: webhookSecret || '' }
}

// ========================================
// Mapeo de tipo de documento
// ========================================

/** Código MH para tipo de documento fiscal */
function mapDocumentType(documentType: string | null): string | null {
  if (!documentType) return null
  switch (documentType.toUpperCase()) {
    case 'DUI': return '13'
    case 'NIT': return '36'
    case 'PASSPORT': return '37'
    default: return null
  }
}

/** Determina el tipo DTE: 03 (CCF) si tiene NIT, 01 (Consumidor Final) si no */
function determineTipoDte(documentType: string | null): '01' | '03' {
  return documentType?.toUpperCase() === 'NIT' ? '03' : '01'
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
  error?: string
}

export async function sendToFacturador(
  params: SendToFacturadorParams
): Promise<SendToFacturadorResult> {
  const config = getFacturadorConfig()
  if (!config) {
    return { success: false, error: 'Facturador not configured' }
  }

  const { purchaseId, orderId, user, pkg, originalPrice, finalPrice, discountAmount } = params

  const cliente: FacturadorClienteData = {
    nombre: user.name,
    email: user.email,
    telefono: user.phone,
    tipoDocumento: mapDocumentType(user.documentType),
    numeroDocumento: user.documentId,
    direccion: user.fiscalAddress,
  }

  const payload: FacturadorOutboundPayload = {
    event: 'purchase.completed',
    timestamp: new Date().toISOString(),
    tenant_id: config.tenantId,
    correlation_id: purchaseId,
    data: {
      tipoDocumento: determineTipoDte(user.documentType),
      montoTotal: originalPrice,
      montoTotalOperacion: finalPrice,
      descuentoAplicado: discountAmount,
      moneda: 'USD',
      cliente,
      items: [
        {
          numeroItem: 1,
          descripcion: `${pkg.name} - Wellnest Studio`,
          cantidad: 1,
          precioUnitario: originalPrice,
          montoDescu: discountAmount,
          ventaGravada: finalPrice,
        },
      ],
      external_reference: purchaseId,
      wellnest_user_id: user.id,
      wellnest_package_id: pkg.id,
      wellnest_credits: pkg.classCount,
      metadata: {
        orderId,
        environment: process.env.NODE_ENV || 'development',
        tenantName: 'Wellnest',
      },
    },
  }

  const url = `${config.apiUrl}/api/webhooks/inbound/wellnest/${config.tenantId}`

  console.log('[FACTURADOR] Sending to Facturador SV:', {
    url,
    purchaseId,
    userId: user.id,
    amount: finalPrice,
    tipoDte: payload.data.tipoDocumento,
  })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.jwtToken}`,
        'X-Tenant-ID': config.tenantId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => 'No body')
      console.error('[FACTURADOR] API error:', {
        status: response.status,
        body: body.substring(0, 500),
      })
      return { success: false, error: `HTTP ${response.status}: ${body.substring(0, 200)}` }
    }

    console.log('[FACTURADOR] Successfully sent to Facturador SV:', { purchaseId })
    return { success: true }
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
