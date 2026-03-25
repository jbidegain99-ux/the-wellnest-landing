/**
 * Fix finalPrice for 15 manually-registered purchases
 * These were paid outside the site (cash/transfer) and registered
 * with finalPrice=$0 instead of the actual package price.
 *
 * Expected correction: $1,374.42
 * Expected total after fix (invoiceStatus='sent_to_facturador'): $4,701.48
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ManualPurchase {
  userName: string
  datePrefix: string // YYYY-MM-DD prefix to match createdAt
  expectedPrice: number
  packageName: string
}

const PURCHASES_TO_FIX: ManualPurchase[] = [
  { userName: 'Paola Nasser', datePrefix: '2026-03-20', expectedPrice: 355.00, packageName: 'Wellnest Trimestral (80 clases)' },
  { userName: 'Esther Umanzor', datePrefix: '2026-03-20', expectedPrice: 355.00, packageName: 'Wellnest Trimestral (80 clases)' },
  { userName: 'Axa Torres', datePrefix: '2026-03-03', expectedPrice: 95.00, packageName: 'Energía Total (12 clases)' },
  { userName: 'Nicolle Peña', datePrefix: '2026-03-03', expectedPrice: 92.00, packageName: 'Vital Plan (16 clases)' },
  { userName: 'Luz Marina Avalos', datePrefix: '2026-03-13', expectedPrice: 69.99, packageName: 'Balance Pass (8 clases)' },
  { userName: 'Lidia Ramirez', datePrefix: '2026-03-05', expectedPrice: 69.99, packageName: 'Balance Pass (8 clases)' },
  { userName: 'Francisco torres', datePrefix: '2026-03-18', expectedPrice: 49.99, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Victoria Sosa', datePrefix: '2026-03-17', expectedPrice: 49.99, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Vanessa Herrera', datePrefix: '2026-03-13', expectedPrice: 49.99, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Génesis Romero', datePrefix: '2026-03-12', expectedPrice: 49.99, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Ale Escamilla', datePrefix: '2026-03-11', expectedPrice: 49.99, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Wendy Portillo', datePrefix: '2026-03-03', expectedPrice: 42.49, packageName: 'Mini Flow (4 clases)' },
  { userName: 'Sophia Valles', datePrefix: '2026-03-21', expectedPrice: 15.00, packageName: 'Welcome to Wellnest (2 clases)' },
  // Sophia Valles has 2 purchases on 2026-03-15 — both "1 Clase" at $15.00
  { userName: 'Sophia Valles', datePrefix: '2026-03-15', expectedPrice: 15.00, packageName: '1 Clase' },
]

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('FIX: finalPrice en compras registradas manualmente')
  console.log('═══════════════════════════════════════════════════\n')

  // Pre-check: current total for invoiced purchases
  const preCheck = await prisma.$queryRaw<[{ total: number; count: bigint }]>`
    SELECT COALESCE(SUM(p."finalPrice"), 0) as total, COUNT(*) as count
    FROM "Purchase" p
    WHERE p."invoiceStatus" = 'sent_to_facturador'
  `
  console.log(`ANTES: total=$${Number(preCheck[0].total).toFixed(2)}, count=${preCheck[0].count}\n`)

  let updated = 0
  let totalCorrected = 0

  for (const entry of PURCHASES_TO_FIX) {
    // Use UTC date range (full day) since admin-assigned purchases
    // were created at various UTC times on the given date
    const dayStart = new Date(`${entry.datePrefix}T00:00:00.000Z`)
    const dayEnd = new Date(`${entry.datePrefix}T23:59:59.999Z`)

    // Find purchases matching: user name (contains, for trailing spaces) + date + finalPrice=0 + package name
    const matches = await prisma.purchase.findMany({
      where: {
        user: { name: { contains: entry.userName, mode: 'insensitive' } },
        createdAt: { gte: dayStart, lt: dayEnd },
        finalPrice: 0,
        package: { name: entry.packageName },
      },
      include: {
        user: { select: { name: true } },
        package: { select: { name: true, price: true } },
      },
    })

    if (matches.length === 0) {
      console.log(`⚠️  NO ENCONTRADO: ${entry.userName} / ${entry.datePrefix} / ${entry.packageName}`)
      continue
    }

    // For Sophia Valles 2026-03-15 there may be 2 "1 Clase" purchases — update all
    for (const purchase of matches) {
      const pkgPrice = purchase.package.price

      if (pkgPrice !== entry.expectedPrice) {
        console.log(`⚠️  PRECIO DIFERENTE: ${entry.userName} — Package.price=$${pkgPrice} vs expected=$${entry.expectedPrice}`)
      }

      const shouldMarkManual =
        !purchase.paymentProviderId ||
        purchase.paymentProviderId.startsWith('trial_') ||
        purchase.paymentProviderId.startsWith('admin_')

      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          finalPrice: entry.expectedPrice,
          originalPrice: entry.expectedPrice,
          ...(shouldMarkManual ? { paymentProviderId: 'manual_payment' } : {}),
        },
      })

      console.log(`✅ ${purchase.user.name.padEnd(22)} ${entry.datePrefix}  $0.00 → $${entry.expectedPrice.toFixed(2).padStart(6)}  (${purchase.package.name})`)
      updated++
      totalCorrected += entry.expectedPrice
    }
  }

  console.log(`\nActualizados: ${updated} purchases`)
  console.log(`Total corregido: $${totalCorrected.toFixed(2)}`)

  // Post-check
  const postCheck = await prisma.$queryRaw<[{ total: number; count: bigint }]>`
    SELECT COALESCE(SUM(p."finalPrice"), 0) as total, COUNT(*) as count
    FROM "Purchase" p
    WHERE p."invoiceStatus" = 'sent_to_facturador'
  `
  const postTotal = Number(postCheck[0].total)
  console.log(`\nDESPUÉS: total=$${postTotal.toFixed(2)}, count=${postCheck[0].count}`)

  const expected = 4701.48
  const diff = Math.abs(postTotal - expected)
  if (diff < 0.01) {
    console.log(`\n✅ VERIFICACIÓN EXITOSA: $${postTotal.toFixed(2)} === $${expected.toFixed(2)}`)
  } else {
    console.log(`\n❌ DIFERENCIA: $${postTotal.toFixed(2)} vs esperado $${expected.toFixed(2)} (diff=$${diff.toFixed(2)})`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
