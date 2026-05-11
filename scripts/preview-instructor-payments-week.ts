/**
 * Preview del reporte semanal de pago a instructores — NO envía email.
 * Imprime resumen y escribe Excel a tasks/reports/ para inspección.
 *
 * Uso:
 *   pnpm tsx scripts/preview-instructor-payments-week.ts
 *     → semana cerrada anterior (Mon-Sun en hora SV)
 *
 *   pnpm tsx scripts/preview-instructor-payments-week.ts 2026-05-04
 *     → semana específica empezando el lunes dado (formato YYYY-MM-DD)
 */

import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../src/lib/prisma'
import {
  computeInstructorPayments,
  buildInstructorPaymentsExcel,
  previousWeekBoundsSV,
  weekBoundsFromMondaySV,
} from '../src/lib/instructorPayments'

async function main() {
  const arg = process.argv[2]
  const bounds = arg ? weekBoundsFromMondaySV(arg) : previousWeekBoundsSV()

  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log(` PREVIEW: Pago a instructores — ${bounds.label}`)
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(`Período UTC: ${bounds.start.toISOString()} → ${bounds.end.toISOString()}`)
  console.log(`Período SV:  Lunes 00:00 → Lunes 00:00 (Mon-Sun completos)\n`)

  const result = await computeInstructorPayments(prisma, bounds.start, bounds.end)

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

  if (result.classesCounted === 0) {
    console.log('\n⚠ No hay clases en el período — no se generará Excel.')
    await prisma.$disconnect()
    return
  }

  const buf = buildInstructorPaymentsExcel(result, bounds.label)
  const outDir = path.join(process.cwd(), 'tasks', 'reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const safeLabel = bounds.label.replace(/\s+/g, '_').replace(/-/g, '_')
  const outPath = path.join(outDir, `PREVIEW_pago_instructores_${safeLabel}.xlsx`)
  fs.writeFileSync(outPath, buf)
  console.log(`\n✓ Excel preview generado: ${outPath}`)
  console.log('  (NO se envió email — esto es solo preview para aprobación)\n')

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
