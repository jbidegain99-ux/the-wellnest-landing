/**
 * Reenvío puntual del Reporte de Ventas de agosto 2026.
 *
 * El cron del 1-sep 6:30 AM SV ya había enviado agosto con el método de
 * atribución anterior (reparto del precio del paquete entre las disciplinas
 * del comprador). Ese método asignó $839.91 a Yoga por un trimestral de $355
 * con una sola reserva detrás. Este script reenvía el mismo mes con la
 * atribución por clase consumida, con una nota que explica el cambio para que
 * los dos correos no se lean como una contradicción.
 *
 * Es de un solo uso: de septiembre en adelante el cron ya sale corregido.
 *
 *   npx tsx scripts/send-reporte-ventas-agosto-recalculado.ts          # dry-run
 *   npx tsx scripts/send-reporte-ventas-agosto-recalculado.ts --send
 */

import './loadEnv'
import * as fs from 'fs'
import * as path from 'path'

const RECIPIENTS = ['jbidegain@republicode.com', 'alexis2293@gmail.com']

const NOTA = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr><td style="background:#FEF7ED;border:1px solid #F5D0A9;border-left:4px solid #C2703D;border-radius:8px;padding:16px;">
              <p style="margin:0 0 8px;font-size:14px;color:#1F2937;font-weight:600;">Corrige el reporte enviado esta mañana</p>
              <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">
                Alexis notó que la atribución de ingresos por disciplina no cuadraba con el
                comportamiento de las ventas: $839.91 a Yoga contra $325.11 a Mat Pilates,
                pese a que ambas tuvieron 40 asistencias. Dividiendo daba $20.97 por clase,
                imposible contra el precio de lista. Tenía razón.
              </p>
              <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">
                El método anterior repartía el precio completo de cada paquete entre las
                disciplinas según las reservas de ese comprador dentro del mes. Con
                denominadores de una o dos reservas el número se disparaba: un Wellnest
                Trimestral de $355 comprado el 25 de agosto, con una sola reserva de yoga
                después, puso los $355 completos en Yoga — el 42% del total de la disciplina.
                El 86% de los ingresos de Yoga venía de compras con 1-2 reservas.
              </p>
              <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">
                Ahora cada reserva se valora al precio por clase del paquete que la pagó y se
                asigna a la disciplina de esa clase. Los $/clase de agosto quedan entre $7.86
                y $9.48, coherentes con los precios reales.
              </p>
              <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">
                <strong>Importante:</strong> el total de la hoja 6 ($3,469.23) ya no cuadra con
                las ventas del mes ($4,999.46), y es a propósito. Mide consumo, no caja:
                incluye clases de paquetes comprados en meses anteriores y deja fuera el saldo
                vendido que todavía no se usa. La hoja muestra las dos cifras y su diferencia.
              </p>
              <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
                Las ventas totales, el detalle diario, semanal, paquetes y clientes
                <strong>no cambian</strong> respecto al correo de la mañana. Solo cambia la
                hoja de ingresos por disciplina. De septiembre en adelante el reporte
                automático ya sale con este método.
              </p>
            </td></tr>
          </table>`

async function main() {
  const doSend = process.argv.includes('--send')
  const { prisma } = await import('../src/lib/prisma')
  const { monthBoundsFromYmSV } = await import('../src/lib/instructorPayments')
  const { computeSalesReport, buildSalesReportExcel, buildSalesEmailHtml, salesReportFilename } =
    await import('../src/lib/salesReport')

  const bounds = monthBoundsFromYmSV('2026-08')
  const data = await computeSalesReport(prisma, bounds)
  const buf = buildSalesReportExcel(data)
  const filename = salesReportFilename(bounds.label)

  const outPath = path.join(process.cwd(), 'tasks', 'reports', filename)
  fs.writeFileSync(outPath, buf)

  // La nota va justo antes del bloque de métricas; el ancla es el subtítulo
  // con el período, que buildSalesEmailHtml siempre emite.
  const baseHtml = buildSalesEmailHtml(data)
  const anchor = '</p>\n          <table role="presentation" width="100%"'
  if (!baseHtml.includes(anchor)) {
    throw new Error('No se encontró el ancla para insertar la nota; revisar buildSalesEmailHtml.')
  }
  const html = baseHtml.replace(anchor, `</p>${NOTA}\n          <table role="presentation" width="100%"`)

  console.log(`Período:   ${bounds.label}`)
  console.log(`Ventas:    $${data.totalGross.toFixed(2)}`)
  console.log(`Consumo:   $${data.consumptionTotal.toFixed(2)}`)
  console.log(`Adjunto:   ${filename} (${(buf.length / 1024).toFixed(0)} KB)`)
  console.log(`Para:      ${RECIPIENTS.join(', ')}`)

  if (!doSend) {
    const preview = path.join(process.cwd(), 'tasks', 'reports', 'PREVIEW_correo_ventas_agosto_recalculado.html')
    fs.writeFileSync(preview, html)
    console.log(`\nDry-run. Vista previa del correo: ${preview}`)
    console.log('Para enviar: npx tsx scripts/send-reporte-ventas-agosto-recalculado.ts --send')
    await prisma.$disconnect()
    return
  }

  const { sendEmail } = await import('../src/lib/emailService')
  const result = await sendEmail({
    to: RECIPIENTS,
    subject: `Reporte de Ventas — Wellnest Studio · ${bounds.label} (corregido: ingresos por disciplina)`,
    html,
    attachments: [{
      filename,
      contentBase64: buf.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  })
  console.log(result.success ? `\n✅ Enviado a ${RECIPIENTS.length} destinatario(s).` : `\n✗ Falló: ${result.error}`)
  await prisma.$disconnect()
  if (!result.success) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
