/**
 * Cron mensual del Reporte de Ventas.
 *
 * Schedule: día 1 de cada mes, 12:30 UTC (= 06:30 SV), 30 min después del
 * cron mensual de pago a instructores para no competir por conexiones de DB.
 *
 * Calcula el mes calendario anterior completo (día 1 00:00 SV → día 1 del mes
 * siguiente 00:00 SV), genera el Excel de 8 hojas (resumen ejecutivo, detalle
 * diario/semanal, paquetes, top clientes, % por disciplina + pagos a
 * instructores, ocupación por clase, listado de ventas) y lo envía adjunto.
 *
 * Destinatarios: env var `SALES_REPORT_RECIPIENT` (coma-separado).
 *   Default: jbidegain@republicode.com, alexis2293@gmail.com
 *
 * Sin UI en admin. Solo accesible vía:
 *   - Cron de Vercel (envía `Authorization: Bearer $CRON_SECRET`)
 *   - Disparo manual con `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/sales-report`
 *
 * Opcional: `?month=YYYY-MM` (mes calendario en hora SV) para un período específico.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/emailService'
import { previousMonthBoundsSV, monthBoundsFromYmSV } from '@/lib/instructorPayments'
import {
  computeSalesReport,
  buildSalesReportExcel,
  buildSalesEmailHtml,
  salesReportFilename,
} from '@/lib/salesReport'

// Comparación en tiempo constante para secretos
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_RECIPIENTS = ['jbidegain@republicode.com', 'alexis2293@gmail.com']

function parseRecipients(): string[] {
  const env = process.env.SALES_REPORT_RECIPIENT
  if (!env) return DEFAULT_RECIPIENTS
  return env.split(',').map(s => s.trim()).filter(Boolean)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON_SALES_REPORT] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (!timingSafeEqualStr(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const monthParam = req.nextUrl.searchParams.get('month')
  let bounds: { start: Date; end: Date; label: string }
  if (monthParam) {
    try {
      bounds = monthBoundsFromYmSV(monthParam)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'invalid month'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  } else {
    bounds = previousMonthBoundsSV()
  }

  console.log(`[CRON_SALES_REPORT] Computing for ${bounds.label} (${bounds.start.toISOString()} → ${bounds.end.toISOString()})`)

  const data = await computeSalesReport(prisma, bounds)
  console.log(`[CRON_SALES_REPORT] ${data.orderCount} compras, $${data.totalGross.toFixed(2)} bruto, ocupación ${data.monthOccPct.toFixed(1)}%`)

  if (data.orderCount === 0) {
    console.log(`[CRON_SALES_REPORT] No purchases in period, skipping email`)
    return NextResponse.json({
      ok: true,
      period: bounds.label,
      orderCount: 0,
      emailSent: false,
      reason: 'No purchases in period',
    })
  }

  const buf = buildSalesReportExcel(data)
  const filename = salesReportFilename(bounds.label)
  const recipients = parseRecipients()

  const emailResult = await sendEmail({
    to: recipients,
    subject: `Reporte de Ventas — Wellnest Studio · ${bounds.label}`,
    html: buildSalesEmailHtml(data),
    attachments: [{
      filename,
      contentBase64: buf.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  })

  if (!emailResult.success) {
    console.error(`[CRON_SALES_REPORT] Email failed: ${emailResult.error}`)
    return NextResponse.json({
      ok: false,
      period: bounds.label,
      orderCount: data.orderCount,
      emailSent: false,
      error: emailResult.error,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    period: bounds.label,
    orderCount: data.orderCount,
    totalGross: data.totalGross,
    uniqueCustomers: data.uniqueCustomers,
    monthOccPct: data.monthOccPct,
    emailSent: true,
    recipients,
  })
}

// try/catch global: el cron corre solo una vez al mes — un error inesperado
// sin alerta significa un mes sin reporte de ventas y nadie se entera.
// Runbook de re-disparo manual: GET con ?month=YYYY-MM y header
// Authorization: Bearer $CRON_SECRET.
async function handleSafely(req: NextRequest): Promise<NextResponse> {
  try {
    return await handle(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CRON_SALES_REPORT] Unhandled error:', error)
    const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@wellneststudio.net'
    await sendEmail({
      to: recipient,
      subject: '[Wellnest] Falló el cron mensual del reporte de ventas',
      html: `<p>El cron mensual del reporte de ventas falló con el error:</p><pre>${message}</pre><p>Re-disparo manual: GET /api/cron/sales-report?month=YYYY-MM con Authorization Bearer CRON_SECRET.</p>`,
    }).catch((emailErr) => {
      console.error('[CRON_SALES_REPORT] Alert email also failed:', emailErr)
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleSafely(req)
}

export async function POST(req: NextRequest) {
  return handleSafely(req)
}
