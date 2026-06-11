import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendToFacturador } from '@/lib/facturador'
import { sendEmail } from '@/lib/emailService'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/retry-invoices — corre cada hora (vercel.json).
 *
 * La emisión de DTE es una obligación fiscal con plazos: un fallo transitorio
 * del facturador no puede dejar la compra sin factura para siempre.
 *
 * - Reintenta purchases con invoiceStatus 'failed' (pagadas, finalPrice > 0)
 *   de los últimos 14 días, con backoff implícito (no toca las falladas hace
 *   menos de 1 hora).
 * - Alerta a los admins de purchases enviadas hace > 6 horas cuyo webhook de
 *   confirmación nunca llegó ('sent_to_facturador' estancado).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON_RETRY_INVOICES] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)
  const oneHourAgo = new Date(now - 60 * 60 * 1000)
  const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000)

  // 1. Reintentar DTEs fallidos
  const failed = await prisma.purchase.findMany({
    where: {
      invoiceStatus: 'failed',
      finalPrice: { gt: 0 },
      createdAt: { gte: fourteenDaysAgo },
      // backoff: el claim de abajo solo toma las que no se tocaron en 1h
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          documentId: true,
          documentType: true,
          fiscalAddress: true,
        },
      },
      package: { select: { id: true, name: true, classCount: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  let retried = 0
  let recovered = 0
  for (const purchase of failed) {
    // Claim atómico (evita doble envío si el cron se solapa) + backoff de 1h
    // usando invoiceSentAt como marca del último intento
    const claimed = await prisma.purchase.updateMany({
      where: {
        id: purchase.id,
        invoiceStatus: 'failed',
        OR: [{ invoiceSentAt: null }, { invoiceSentAt: { lt: oneHourAgo } }],
      },
      data: { invoiceStatus: 'processing', invoiceSentAt: new Date() },
    })
    if (claimed.count === 0) continue

    retried++
    try {
      const result = await sendToFacturador({
        purchaseId: purchase.id,
        user: purchase.user,
        pkg: purchase.package,
        originalPrice: purchase.originalPrice > 0 ? purchase.originalPrice : purchase.finalPrice,
        finalPrice: purchase.finalPrice,
        discountAmount: Math.max(
          0,
          Math.round(((purchase.originalPrice || purchase.finalPrice) - purchase.finalPrice) * 100) / 100
        ),
      })

      await prisma.purchase.update({
        where: { id: purchase.id },
        data: result.success
          ? { invoiceStatus: 'sent_to_facturador', invoiceSentAt: new Date(), invoiceError: null }
          : { invoiceStatus: 'failed', invoiceError: result.error || 'Unknown error' },
      })
      if (result.success) recovered++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      await prisma.purchase.updateMany({
        where: { id: purchase.id, invoiceStatus: 'processing' },
        data: { invoiceStatus: 'failed', invoiceError: message },
      }).catch(() => {})
    }
  }

  // 2. Detectar envíos estancados sin webhook de confirmación
  const stuck = await prisma.purchase.findMany({
    where: {
      invoiceStatus: 'sent_to_facturador',
      invoiceSentAt: { lt: sixHoursAgo, gte: fourteenDaysAgo },
      finalPrice: { gt: 0 },
    },
    select: { id: true, invoiceSentAt: true, finalPrice: true, package: { select: { name: true } } },
    take: 50,
  })

  if (stuck.length > 0) {
    const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@wellneststudio.net'
    const rows = stuck
      .map(
        (p) =>
          `<li>${p.id} — ${p.package.name} — $${p.finalPrice.toFixed(2)} — enviado ${p.invoiceSentAt?.toISOString()}</li>`
      )
      .join('')
    await sendEmail({
      to: recipient,
      subject: `[Wellnest] ${stuck.length} factura(s) DTE sin confirmación del facturador`,
      html: `<p>Estas compras fueron enviadas al facturador hace más de 6 horas y no han recibido webhook de confirmación:</p><ul>${rows}</ul><p>Revisar el facturador y reintentar manualmente si aplica.</p>`,
    }).catch((err) => console.error('[CRON_RETRY_INVOICES] Alert email failed:', err))
  }

  console.log('[CRON_RETRY_INVOICES] Done:', { candidates: failed.length, retried, recovered, stuck: stuck.length })
  return NextResponse.json({ candidates: failed.length, retried, recovered, stuck: stuck.length })
}
