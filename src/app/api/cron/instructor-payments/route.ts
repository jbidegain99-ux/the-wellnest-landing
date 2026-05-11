/**
 * Cron semanal de pago a instructores.
 *
 * Schedule: lunes 12:00 UTC (= 06:00 SV).
 * Calcula la semana cerrada anterior (Lunes 00:00 SV → Lunes 00:00 SV), genera
 * Excel con desglose por instructor / disciplina / clase y lo envía como adjunto
 * a la lista de destinatarios.
 *
 * Destinatarios: env var `INSTRUCTOR_PAYMENTS_RECIPIENT` (coma-separado).
 *   Default: jbidegain@republicode.com, alexis2293@gmail.com
 *
 * Sin UI en admin. Solo accesible vía:
 *   - Cron de Vercel (envía `Authorization: Bearer $CRON_SECRET`)
 *   - Disparo manual con `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/instructor-payments`
 *
 * Opcional: `?weekStart=YYYY-MM-DD` (debe ser lunes en hora SV) para un período específico.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/emailService'
import {
  computeInstructorPayments,
  buildInstructorPaymentsExcel,
  previousWeekBoundsSV,
  weekBoundsFromMondaySV,
} from '@/lib/instructorPayments'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEFAULT_RECIPIENTS = ['jbidegain@republicode.com', 'alexis2293@gmail.com']

function parseRecipients(): string[] {
  const env = process.env.INSTRUCTOR_PAYMENTS_RECIPIENT
  if (!env) return DEFAULT_RECIPIENTS
  return env.split(',').map(s => s.trim()).filter(Boolean)
}

function buildEmailHtml(periodLabel: string, totals: { classes: number; bruto: number; neto: number; renta: number }): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Pago a instructores — ${periodLabel}</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:20px;font-weight:600;">Reporte semanal de pago a instructores</h1>
          <p style="color:#6B7280;margin:0 0 24px;font-size:14px;">Wellnest Studio · ${periodLabel}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Clases pagadas:</strong> ${totals.classes}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total bruto:</strong> $${totals.bruto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total neto (a pagar):</strong> $${totals.neto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Renta retenida (10%):</strong> $${totals.renta.toFixed(2)}</p>
            </td></tr>
          </table>
          <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:16px 0 0;">Adjunto encontrarás el Excel con tres hojas: Resumen por Instructor, Detalle por Disciplina y Detalle por Clase. Reglas según escala vigente desde el 11 de Mayo 2026. Excluye clases canceladas, privadas (1:1) y reservas de usuarios de prueba.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON_INSTRUCTOR_PAYMENTS] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartParam = req.nextUrl.searchParams.get('weekStart')
  let bounds: { start: Date; end: Date; label: string }
  if (weekStartParam) {
    try {
      bounds = weekBoundsFromMondaySV(weekStartParam)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'invalid weekStart'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  } else {
    bounds = previousWeekBoundsSV()
  }

  console.log(`[CRON_INSTRUCTOR_PAYMENTS] Computing for ${bounds.label} (${bounds.start.toISOString()} → ${bounds.end.toISOString()})`)

  const result = await computeInstructorPayments(prisma, bounds.start, bounds.end)
  console.log(`[CRON_INSTRUCTOR_PAYMENTS] ${result.classesCounted} clases, $${result.totalNeto.toFixed(2)} neto, $${result.totalRenta.toFixed(2)} renta`)

  if (result.classesCounted === 0) {
    console.log(`[CRON_INSTRUCTOR_PAYMENTS] No classes in period, skipping email`)
    return NextResponse.json({
      ok: true,
      period: bounds.label,
      classesCounted: 0,
      emailSent: false,
      reason: 'No classes in period',
    })
  }

  const buf = buildInstructorPaymentsExcel(result, bounds.label)
  const filename = `pago_instructores_${bounds.label.replace(/\s+/g, '_').replace(/-/g, '_')}.xlsx`
  const recipients = parseRecipients()

  const emailResult = await sendEmail({
    to: recipients,
    subject: `Pago a instructores — ${bounds.label}`,
    html: buildEmailHtml(bounds.label, {
      classes: result.classesCounted,
      bruto: result.totalBruto,
      neto: result.totalNeto,
      renta: result.totalRenta,
    }),
    attachments: [{
      filename,
      contentBase64: buf.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  })

  if (!emailResult.success) {
    console.error(`[CRON_INSTRUCTOR_PAYMENTS] Email failed: ${emailResult.error}`)
    return NextResponse.json({
      ok: false,
      period: bounds.label,
      classesCounted: result.classesCounted,
      emailSent: false,
      error: emailResult.error,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    period: bounds.label,
    classesCounted: result.classesCounted,
    totalNeto: result.totalNeto,
    totalRenta: result.totalRenta,
    emailSent: true,
    recipients,
  })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
