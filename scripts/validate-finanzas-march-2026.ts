/**
 * Validation script for the new /admin/finanzas dashboard.
 *
 * Runs the same aggregation the page runs, over the exact March 2026 SV range,
 * and prints what the dashboard should show. Compares against the known bank
 * balance of $4,422.43.
 *
 * Usage: npx tsx scripts/validate-finanzas-march-2026.ts
 */

import { prisma } from '../src/lib/prisma'
import { EXCLUDED_USER_IDS } from '../src/lib/constants'
import { getExcludedPurchaseIds } from '../src/lib/excluded-purchases'
import { aggregatePurchases, type RawPurchase } from '../src/lib/finance/aggregate'
import { getCurrentFinancialConfig } from '../src/lib/finance/config'

const MARCH_START_UTC = new Date('2026-03-01T06:00:00.000Z') // 1-mar 00:00 SV
const APRIL_START_UTC = new Date('2026-04-01T06:00:00.000Z') // 1-apr 00:00 SV

const BANK_REAL = 4422.43

function fmt(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

async function main() {
  console.log('📊 Validación: /admin/finanzas vs Banco real (Marzo 2026 SV)\n')

  const excludedIds = await getExcludedPurchaseIds()
  const purchases = await prisma.purchase.findMany({
    where: {
      userId: { notIn: EXCLUDED_USER_IDS },
      ...(excludedIds.length > 0 && { id: { notIn: excludedIds } }),
      createdAt: { gte: MARCH_START_UTC, lt: APRIL_START_UTC },
    },
    select: {
      id: true,
      finalPrice: true,
      paymentProviderId: true,
      createdAt: true,
    },
  })

  const config = getCurrentFinancialConfig()
  const rows: RawPurchase[] = purchases.map((p) => ({
    id: p.id,
    finalPrice: p.finalPrice,
    paymentProviderId: p.paymentProviderId,
    createdAt: p.createdAt,
  }))

  const totals = aggregatePurchases(rows, config)

  console.log('Config aplicada:')
  console.log(`  IVA:              ${(config.ivaRate * 100).toFixed(1)}% (incluido: ${config.ivaIncludedInPrice})`)
  console.log(`  Comisión:         ${(config.gatewayFeeRate * 100).toFixed(2)}% + IVA`)
  console.log(`  3DS por txn:      $${config.tds3DsPerTransaction.toFixed(2)} + IVA`)
  console.log(`  Retención:        ${config.retencionEnabled ? 'ON' : 'OFF'}`)
  console.log()

  console.log('Totales marzo 2026:')
  console.log(`  Transacciones:    ${totals.count}`)
  console.log(`  Bruto:            ${fmt(totals.bruto)}`)
  console.log(`  Base imponible:   ${fmt(totals.baseImponible)}`)
  console.log(`  IVA ventas:       ${fmt(totals.iva)}`)
  console.log(`  Comisión base:    ${fmt(totals.feeBase)}`)
  console.log(`  Comisión IVA:     ${fmt(totals.feeIva)}`)
  console.log(`  3DS total:        ${fmt(totals.tdsFee)}`)
  console.log(`  Comisión total:   ${fmt(totals.fee)}`)
  console.log(`  Retención:        ${fmt(totals.retencion)}`)
  console.log(`  Neto al banco:    ${fmt(totals.neto)}  ← card "Dinero al banco"`)
  console.log(`  IVA al Ministerio: ${fmt(totals.ivaToPayMinistry)}  ← card "IVA a pagar"`)
  console.log()

  console.log('Desglose por método:')
  for (const method of ['PAYWAY', 'MANUAL', 'OFFLINE', 'TRIAL'] as const) {
    const m = totals.byMethod[method]
    if (m.count === 0) continue
    console.log(
      `  ${method.padEnd(9)} ${String(m.count).padStart(4)} txn   bruto ${fmt(m.bruto).padStart(11)}   fee ${fmt(m.fee).padStart(9)}   neto ${fmt(m.neto).padStart(11)}`
    )
  }
  console.log()

  console.log('Reconciliación vs banco real:')
  console.log(`  Dashboard neto estimado:  ${fmt(totals.neto)}`)
  console.log(`  Banco real reportado:     ${fmt(BANK_REAL)}`)
  const gap = totals.neto - BANK_REAL
  const gapLabel = gap >= 0 ? 'sobra en BD' : 'falta en BD'
  console.log(`  Gap:                      ${fmt(Math.abs(gap))} (${gapLabel})`)
  console.log()
  console.log('Nota: el gap remanente es esperable y corresponde a')
  console.log('  (a) transacciones cruzando mes cuya liquidación cayó en abril,')
  console.log('  (b) rolling reserve, y')
  console.log('  (c) transferencias manuales que no pasaron por Cuscatlán.')
  console.log('  Fase 3 resolverá esto con matching por bankSettledAt.')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
