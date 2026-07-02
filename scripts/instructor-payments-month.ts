/**
 * Reporte MENSUAL de pago a instructores — el mismo reporte del cron semanal de
 * los lunes (computeInstructorPayments / buildInstructorPaymentsExcel) pero sobre
 * el mes calendario completo en hora SV. Preview en terminal + envío opcional.
 *
 * Mismos destinatarios que el cron semanal:
 *   env INSTRUCTOR_PAYMENTS_RECIPIENT (default jbidegain@republicode.com, alexis2293@gmail.com)
 *
 * Uso:
 *   pnpm tsx scripts/instructor-payments-month.ts 2026-05
 *     → preview en terminal + Excel a tasks/reports/ (NO envía email)
 *
 *   pnpm tsx scripts/instructor-payments-month.ts 2026-05 --send
 *     → además envía el email con adjunto a los destinatarios
 */

import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../src/lib/prisma'
import { sendEmail } from '../src/lib/emailService'
import {
  computeInstructorPayments,
  buildInstructorPaymentsExcel,
  monthBoundsFromYmSV,
  type InstructorPaymentsResult,
} from '../src/lib/instructorPayments'

const DEFAULT_RECIPIENTS = ['jbidegain@republicode.com', 'alexis2293@gmail.com']

function parseRecipients(): string[] {
  const env = process.env.INSTRUCTOR_PAYMENTS_RECIPIENT
  if (!env) return DEFAULT_RECIPIENTS
  return env.split(',').map(s => s.trim()).filter(Boolean)
}

/** Misma plantilla de email que el cron semanal, ajustada a "mensual". */
function buildEmailHtml(periodLabel: string, totals: { classes: number; bruto: number; neto: number; renta: number }): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Pago a instructores — ${periodLabel}</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:20px;font-weight:600;">Reporte mensual de pago a instructores</h1>
          <p style="color:#6B7280;margin:0 0 24px;font-size:14px;">Wellnest Studio · ${periodLabel}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Clases pagadas:</strong> ${totals.classes}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total bruto:</strong> $${totals.bruto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Total neto (a pagar):</strong> $${totals.neto.toFixed(2)}</p>
              <p style="margin:4px 0;font-size:13px;color:#374151;"><strong>Renta retenida (10%):</strong> $${totals.renta.toFixed(2)}</p>
            </td></tr>
          </table>
          <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:16px 0 0;">Adjunto encontrarás el Excel con tres hojas: Resumen por Instructor, Detalle por Instructor y Detalle por Clase. Reglas según escala vigente desde el 11 de Mayo 2026. Excluye clases canceladas, privadas (1:1) y reservas de usuarios de prueba.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function printPreview(result: InstructorPaymentsResult, label: string, bounds: { start: Date; end: Date }) {
  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log(` PREVIEW: Pago a instructores — ${label} (mes completo)`)
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(`Período UTC: ${bounds.start.toISOString()} → ${bounds.end.toISOString()}`)
  console.log(`Período SV:  1 ${label} 00:00 → 1 del mes siguiente 00:00`)
  console.log(`Nota: solo cuenta clases con dateTime <= ahora (${new Date().toISOString()})\n`)

  console.log('═══ TOTALES ═══')
  console.log(`Clases pagadas:   ${result.classesCounted}`)
  console.log(`Total bruto:      $${result.totalBruto.toFixed(2)}`)
  console.log(`Total neto:       $${result.totalNeto.toFixed(2)} (a pagar)`)
  console.log(`Renta retenida:   $${result.totalRenta.toFixed(2)} (10%)`)

  console.log('\n═══ RESUMEN POR INSTRUCTOR ═══')
  console.log(`  ${'Instructor'.padEnd(28)}  ${'Clases'.padStart(6)}  ${'Bruto'.padStart(10)}  ${'Neto'.padStart(10)}  ${'Renta'.padStart(8)}`)
  for (const s of result.summaryByInstructor) {
    console.log(`  ${s.instructorName.padEnd(28).slice(0, 28)}  ${String(s.classes).padStart(6)}  $${s.totalBruto.toFixed(2).padStart(9)}  $${s.totalNeto.toFixed(2).padStart(9)}  $${s.totalRenta.toFixed(2).padStart(7)}`)
  }
  console.log(`  ${'TOTAL'.padEnd(28)}  ${String(result.classesCounted).padStart(6)}  $${result.totalBruto.toFixed(2).padStart(9)}  $${result.totalNeto.toFixed(2).padStart(9)}  $${result.totalRenta.toFixed(2).padStart(7)}`)

  console.log('\n═══ DESGLOSE POR INSTRUCTOR Y DISCIPLINA ═══')
  for (const s of result.summaryByInstructor) {
    const disciplines = Array.from(s.byDiscipline.entries()).sort((a, b) => b[1].neto - a[1].neto)
    console.log(`  ${s.instructorName}:`)
    for (const [name, d] of disciplines) {
      console.log(`    ${name.padEnd(22)}  ${String(d.classes).padStart(2)} clases  bruto $${d.bruto.toFixed(2).padStart(7)}  neto $${d.neto.toFixed(2).padStart(7)}  renta $${d.renta.toFixed(2).padStart(6)}`)
    }
  }
}

async function main() {
  const arg = process.argv[2]
  const send = process.argv.includes('--send')
  if (!arg) {
    console.error('Falta el mes. Uso: pnpm tsx scripts/instructor-payments-month.ts YYYY-MM [--send]')
    process.exit(1)
  }
  const bounds = monthBoundsFromYmSV(arg)

  const result = await computeInstructorPayments(prisma, bounds.start, bounds.end)
  printPreview(result, bounds.label, bounds)

  if (result.classesCounted === 0) {
    console.log('\n⚠ No hay clases en el período — no se generará Excel ni se enviará email.')
    await prisma.$disconnect()
    return
  }

  const buf = buildInstructorPaymentsExcel(result, bounds.label)
  const outDir = path.join(process.cwd(), 'tasks', 'reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const safeLabel = bounds.label.replace(/\s+/g, '_')
  const outPath = path.join(outDir, `PREVIEW_pago_instructores_${safeLabel}.xlsx`)
  fs.writeFileSync(outPath, buf)
  console.log(`\n✓ Excel preview generado: ${outPath}`)

  if (!send) {
    console.log('  (NO se envió email — esto es solo preview para aprobación.')
    console.log('   Para enviar: agrega --send al comando)\n')
    await prisma.$disconnect()
    return
  }

  const recipients = parseRecipients()
  const filename = `pago_instructores_${safeLabel}.xlsx`
  console.log(`\n→ Enviando email a: ${recipients.join(', ')}`)
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
    console.error(`\n✗ Email FALLÓ: ${emailResult.error}`)
    await prisma.$disconnect()
    process.exit(1)
  }
  console.log(`\n✅ Email enviado correctamente a ${recipients.length} destinatario(s).`)
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
