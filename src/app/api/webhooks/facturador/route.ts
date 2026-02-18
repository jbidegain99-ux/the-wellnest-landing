/**
 * Webhook endpoint para recibir respuestas del Facturador Electrónico SV.
 *
 * Eventos manejados:
 * - dte.created:  Factura en proceso de emisión
 * - dte.approved: Factura aprobada por Ministerio de Hacienda
 * - dte.rejected: Factura rechazada por MH
 *
 * Seguridad: Verificación HMAC SHA256 + protección replay (5 min)
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyFacturadorSignature, getFacturadorConfig } from '@/lib/facturador'
import { sendEmail, buildInvoiceEmail } from '@/lib/emailService'
import type {
  FacturadorWebhookPayload,
  FacturadorWebhookEvent,
  DteApprovedData,
  DteRejectedData,
  DteCreatedData,
} from '@/types/facturador'
import type { Prisma } from '@prisma/client'

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // 1. Read raw body for HMAC verification
    const rawBody = await request.text()

    // 2. Extract and validate headers
    const signature = request.headers.get('x-webhook-signature-256') || ''
    const timestamp = request.headers.get('x-webhook-timestamp') || ''
    const eventType = request.headers.get('x-webhook-event') as FacturadorWebhookEvent | null
    const deliveryId = request.headers.get('x-webhook-delivery') || 'unknown'

    console.log('[FACTURADOR-WEBHOOK] Received:', {
      event: eventType,
      deliveryId,
      bodyLength: rawBody.length,
    })

    // 3. Verify HMAC signature
    const config = getFacturadorConfig()
    if (!config?.webhookSecret) {
      console.error('[FACTURADOR-WEBHOOK] Webhook secret not configured')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const verification = verifyFacturadorSignature(
      rawBody,
      signature,
      timestamp,
      config.webhookSecret
    )

    if (!verification.valid) {
      console.error('[FACTURADOR-WEBHOOK] Signature verification failed:', verification.error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 4. Parse payload
    let payload: FacturadorWebhookPayload
    try {
      payload = JSON.parse(rawBody) as FacturadorWebhookPayload
    } catch {
      console.error('[FACTURADOR-WEBHOOK] Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { event, correlation_id: purchaseId, data } = payload

    if (!purchaseId) {
      console.error('[FACTURADOR-WEBHOOK] Missing correlation_id')
      return NextResponse.json({ error: 'Missing correlation_id' }, { status: 400 })
    }

    // 5. Verify purchase exists
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        package: { select: { name: true } },
      },
    })

    if (!purchase) {
      console.error('[FACTURADOR-WEBHOOK] Purchase not found:', purchaseId)
      // Respond 200 to avoid retries for non-existent purchases
      await logWebhook(event, purchaseId, rawBody, 'failed', 'Purchase not found')
      return NextResponse.json({ received: true, warning: 'Purchase not found' })
    }

    // 6. Process by event type
    switch (event) {
      case 'dte.created':
        await handleDteCreated(purchase.id, data as DteCreatedData)
        break

      case 'dte.approved':
        await handleDteApproved(purchase, data as DteApprovedData)
        break

      case 'dte.rejected':
        await handleDteRejected(purchase.id, data as DteRejectedData)
        break

      default:
        console.warn('[FACTURADOR-WEBHOOK] Unknown event type:', event)
    }

    // 7. Log webhook
    await logWebhook(event, purchaseId, rawBody, 'processed')

    const duration = Date.now() - startTime
    console.log('[FACTURADOR-WEBHOOK] Processed successfully:', {
      event,
      purchaseId,
      duration: `${duration}ms`,
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[FACTURADOR-WEBHOOK] Unhandled error:', message)

    return NextResponse.json({ received: true, error: 'Internal processing error' })
  }
}

// ========================================
// Event handlers
// ========================================

async function handleDteCreated(purchaseId: string, data: DteCreatedData): Promise<void> {
  console.log('[FACTURADOR-WEBHOOK] DTE created (processing):', {
    purchaseId,
    dteId: data.dteId,
  })

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      invoiceStatus: 'processing',
      invoiceReference: data.dteId,
    },
  })
}

interface PurchaseWithRelations {
  id: string
  user: { id: string; name: string; email: string }
  package: { name: string }
}

async function handleDteApproved(
  purchase: PurchaseWithRelations,
  data: DteApprovedData
): Promise<void> {
  console.log('[FACTURADOR-WEBHOOK] DTE approved:', {
    purchaseId: purchase.id,
    dteId: data.dteId,
    numeroControl: data.numeroControl,
  })

  await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      invoiceStatus: 'completed',
      dteUuid: data.dteId,
      invoiceNumber: data.numeroControl,
      invoiceSeries: data.codigoGeneracion,
      invoiceUrl: data.urls?.pdf || data.pdf_url,
      invoiceCompletedAt: new Date(),
      invoiceReference: data.dteId,
    },
  })

  // Send invoice email to customer (async, don't block webhook response)
  sendInvoiceEmail(purchase, data).catch((err) => {
    console.error('[FACTURADOR-WEBHOOK] Failed to send invoice email:', err)
  })
}

async function handleDteRejected(purchaseId: string, data: DteRejectedData): Promise<void> {
  console.error('[FACTURADOR-WEBHOOK] DTE rejected:', {
    purchaseId,
    dteId: data.dteId,
    motivo: data.motivoRechazo,
    codigo: data.codigoRechazo,
  })

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      invoiceStatus: 'facturador_error',
      invoiceError: `${data.codigoRechazo}: ${data.motivoRechazo} - ${data.descripcionRechazo}`,
      invoiceReference: data.dteId,
    },
  })
}

// ========================================
// Helpers
// ========================================

async function sendInvoiceEmail(
  purchase: PurchaseWithRelations,
  data: DteApprovedData
): Promise<void> {
  const pdfUrl = data.urls?.pdf || data.pdf_url
  if (!pdfUrl) {
    console.warn('[FACTURADOR-WEBHOOK] No PDF URL in approved DTE, skipping email')
    return
  }

  const html = buildInvoiceEmail(purchase.user.name, {
    packageName: purchase.package.name,
    invoiceNumber: data.numeroControl,
    amount: data.montoTotalOperacion,
    date: data.fechaEmision,
    pdfUrl,
  })

  const result = await sendEmail({
    to: purchase.user.email,
    subject: `Tu factura electrónica - ${purchase.package.name}`,
    html,
  })

  if (result.success) {
    console.log('[FACTURADOR-WEBHOOK] Invoice email sent:', {
      purchaseId: purchase.id,
      email: purchase.user.email,
    })
  } else {
    console.error('[FACTURADOR-WEBHOOK] Invoice email failed:', {
      purchaseId: purchase.id,
      error: result.error,
    })
  }
}

async function logWebhook(
  event: string,
  purchaseId: string,
  rawBody: string,
  status: string,
  error?: string
): Promise<void> {
  try {
    let payload: Prisma.InputJsonValue
    try {
      payload = JSON.parse(rawBody)
    } catch {
      payload = { raw: rawBody.substring(0, 5000) }
    }

    await prisma.webhookLog.create({
      data: {
        source: 'facturador-sv',
        event,
        purchaseId,
        payload,
        status,
        error: error || null,
      },
    })
  } catch (err) {
    console.error('[FACTURADOR-WEBHOOK] Failed to log webhook:', err)
  }
}
