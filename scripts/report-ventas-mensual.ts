/**
 * Reporte de Ventas mensual — versión script (mismo cálculo que el cron
 * /api/cron/sales-report, vía src/lib/salesReport.ts).
 *
 * Imprime el resumen en consola; con --export genera el Excel en
 * tasks/reports/ y con --send además lo envía por correo (Microsoft Graph,
 * mismos destinatarios que el cron: jbidegain@republicode.com y
 * alexis2293@gmail.com, override con SALES_REPORT_RECIPIENT).
 *
 * Uso:
 *   npx tsx scripts/report-ventas-mensual.ts 2026-06            # solo consola
 *   npx tsx scripts/report-ventas-mensual.ts 2026-06 --export   # + Excel
 *   npx tsx scripts/report-ventas-mensual.ts 2026-06 --send     # + Excel + correo
 */

import * as fs from 'fs'
import * as path from 'path'

// --- Carga manual de env (.env + .env.local) antes de importar prisma/email ---
function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvFile(path.resolve(process.cwd(), '.env'))
loadEnvFile(path.resolve(process.cwd(), '.env.local'))

const DEFAULT_RECIPIENTS = ['jbidegain@republicode.com', 'alexis2293@gmail.com']

async function main() {
  const args = process.argv.slice(2)
  const ym = args.find(a => /^\d{4}-\d{2}$/.test(a))
  const doSend = args.includes('--send')
  const doExport = args.includes('--export') || doSend

  if (!ym) {
    console.error('Uso: npx tsx scripts/report-ventas-mensual.ts YYYY-MM [--export] [--send]')
    process.exit(1)
  }

  const { prisma } = await import('../src/lib/prisma')
  const { monthBoundsFromYmSV } = await import('../src/lib/instructorPayments')
  const { computeSalesReport, buildSalesReportExcel, buildSalesEmailHtml, salesReportFilename } = await import('../src/lib/salesReport')

  const bounds = monthBoundsFromYmSV(ym)

  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log(` REPORTE DE VENTAS - ${bounds.label.toUpperCase()} (hora El Salvador)`)
  console.log('═══════════════════════════════════════════════════════════════════\n')

  const data = await computeSalesReport(prisma, bounds)

  console.log('═══ RESUMEN EJECUTIVO ═══')
  console.log(`Bruto (con IVA):     $${data.totalGross.toFixed(2)}`)
  console.log(`IVA 13%:             $${data.totalIva.toFixed(2)}`)
  console.log(`Neto (sin IVA):      $${data.totalNet.toFixed(2)}`)
  console.log(`Compras:             ${data.orderCount}`)
  console.log(`Clientes únicos:     ${data.uniqueCustomers}`)
  console.log(`Ticket promedio:     $${data.avgTicket.toFixed(2)}`)
  console.log(`Ocupación mensual:   ${data.monthOccPct.toFixed(1)}%`)

  console.log('\n═══ INGRESOS POR MÉTODO DE PAGO ═══')
  for (const m of data.byMethod) {
    const pct = data.totalGross > 0 ? ((m.revenue / data.totalGross) * 100).toFixed(1) : '0.0'
    console.log(`  ${m.method.padEnd(18)}  $${m.revenue.toFixed(2).padStart(9)}  ${String(m.orders).padStart(3)} compras  ${pct.padStart(5)}%`)
  }

  console.log('\n═══ RESUMEN SEMANAL ═══')
  for (const w of data.weeklyAgg) {
    console.log(`  ${w.label.padEnd(26)}  $${w.revenue.toFixed(2).padStart(10)}  ${String(w.orders).padStart(3)} compras  ${w.customers} clientes`)
  }

  console.log('\n═══ TOP PAQUETES ═══')
  for (const p of data.packageDistribution.slice(0, 10)) {
    console.log(`  ${String(p.rank).padStart(2)}. ${p.packageName.padEnd(32).slice(0, 32)}  ${String(p.unitsSold).padStart(3)} u.  $${p.totalRevenue.toFixed(2).padStart(9)}  ${String(p.pctTotal).padStart(5)}%`)
  }

  console.log('\n═══ INGRESOS POR DISCIPLINA (clase consumida) + PAGOS A INSTRUCTORES (DB) ═══')
  console.log(`  ${'Disciplina'.padEnd(22)} ${'Ingresos'.padStart(10)} ${'%'.padStart(6)} ${'Res'.padStart(5)} ${'Pag'.padStart(5)} ${'Cort'.padStart(5)} ${'$/clase'.padStart(8)}   Pago instructor`)
  for (const r of data.discRevenueRows) {
    const pct = data.consumptionTotal > 0 ? ((r.revenue / data.consumptionTotal) * 100).toFixed(1) : '0.0'
    const pay = data.instrPayments.get(r.name)
    const pagoStr = pay ? `monto $${pay.monto.toFixed(2)}  a pagar $${pay.aPagar.toFixed(2)}  renta $${pay.rentaRetenida.toFixed(2)}` : '—'
    console.log(
      `  ${r.name.padEnd(22)} $${r.revenue.toFixed(2).padStart(9)} ${pct.padStart(5)}% ` +
      `${String(r.reservations).padStart(5)} ${String(r.paidReservations).padStart(5)} ${String(r.courtesyReservations).padStart(5)} ` +
      `$${r.perPaidClass.toFixed(2).padStart(7)}   ${pagoStr}`,
    )
  }
  const paidRes = data.totalReservations - data.courtesyReservations
  console.log(
    `  ${'TOTAL'.padEnd(22)} $${data.consumptionTotal.toFixed(2).padStart(9)} ${'100.0'.padStart(5)}% ` +
    `${String(data.totalReservations).padStart(5)} ${String(paidRes).padStart(5)} ${String(data.courtesyReservations).padStart(5)} ` +
    `$${(paidRes > 0 ? data.consumptionTotal / paidRes : 0).toFixed(2).padStart(7)}`,
  )
  console.log(`\n  Ventas del mes (caja):  $${data.totalGross.toFixed(2)}`)
  console.log(`  Consumo atribuido:      $${data.consumptionTotal.toFixed(2)}`)
  console.log(`  Diferencia:             $${(data.totalGross - data.consumptionTotal).toFixed(2)}  (saldo vendido sin usar menos consumo de paquetes previos)`)
  console.log(`  TOTAL pagos instructores: monto $${data.instrTotals.monto.toFixed(2)}  a pagar $${data.instrTotals.aPagar.toFixed(2)}  renta $${data.instrTotals.rentaRetenida.toFixed(2)}`)

  console.log('\n═══ OCUPACIÓN MENSUAL POR DISCIPLINA ═══')
  for (const db of data.occupancy) {
    const pct = db.capacity > 0 ? ((db.asistieron / db.capacity) * 100).toFixed(1) : '0.0'
    console.log(`  ${db.name.padEnd(28)}  ${String(db.classCount).padStart(3)} clases  cap ${String(db.capacity).padStart(4)}  asist ${String(db.asistieron).padStart(4)}  ${pct}%`)
  }

  if (!doExport) {
    console.log('\n✓ DATOS LISTOS PARA APROBACIÓN')
    console.log(`  Si los datos son correctos: npx tsx scripts/report-ventas-mensual.ts ${ym} --export (o --send)\n`)
    await prisma.$disconnect()
    return
  }

  console.log('\nGenerando Excel...')
  const buf = buildSalesReportExcel(data)
  const outDir = path.join(process.cwd(), 'tasks', 'reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const filename = salesReportFilename(bounds.label)
  const outPath = path.join(outDir, filename)
  fs.writeFileSync(outPath, buf)
  console.log(`✓ Excel exportado: ${outPath}`)

  if (!doSend) {
    console.log(`\n  Para enviarlo por correo: npx tsx scripts/report-ventas-mensual.ts ${ym} --send\n`)
    await prisma.$disconnect()
    return
  }

  const recipients = process.env.SALES_REPORT_RECIPIENT
    ? process.env.SALES_REPORT_RECIPIENT.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_RECIPIENTS

  const azureOk = !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET)
  if (!azureOk) {
    console.error('\n✗ Faltan credenciales Azure (AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET). Abortando envío.\n')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log('\n═══ ENVÍO (Microsoft Graph) ═══')
  console.log(`  From:    ${process.env.EMAIL_FROM || 'contact@wellneststudio.net'}`)
  console.log(`  To:      ${recipients.join(', ')}`)
  console.log(`  Adjunto: ${filename} (${(buf.length / 1024).toFixed(0)} KB)`)

  const { sendEmail } = await import('../src/lib/emailService')
  const result = await sendEmail({
    to: recipients,
    subject: `Reporte de Ventas — Wellnest Studio · ${bounds.label}`,
    html: buildSalesEmailHtml(data),
    attachments: [{
      filename,
      contentBase64: buf.toString('base64'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  })

  if (result.success) {
    console.log(`\n✓ Enviado correctamente a: ${recipients.join(', ')}\n`)
  } else {
    console.error(`\n✗ Falló el envío: ${result.error}\n`)
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
