/**
 * Backfill de clasificación correcta para los 4 Purchases "OFFLINE" de abril 2026:
 *
 *   - José Portillo (Mini Flow $49.99) → fue un pago POS que no se registró
 *     correctamente; se actualiza finalPrice y paymentProviderId='pos_manual'.
 *   - Marcela Chacón, Esther Umanzor, Laura Rivas → cortesías/regalos;
 *     se marcan con paymentProviderId='gift_manual' (quedan con finalPrice=0).
 *
 * Confirmado por José 2026-04-09.
 *
 * El script es idempotente — detecta si ya se aplicó y no hace nada.
 *
 * Uso: npx tsx scripts/fix-pos-and-gift-purchases.ts
 */

import { prisma } from '../src/lib/prisma'

// Hardcoded Purchase IDs — más seguro que buscar por nombre/email.
// IDs obtenidos de scripts/inspect-offline-purchases.ts (2026-04-09).
const FIXES = [
  {
    purchaseId: 'cmnq8klsz0001wy4l9wpkkb79',
    who: 'José Portillo',
    action: 'POS_PAYMENT',
    newFinalPrice: 49.99,
    newProviderId: 'pos_manual',
    notes: 'Pago por POS físico (Cuscatlán) que no se registró correctamente en el checkout; paquete Mini Flow (4 clases) $49.99',
  },
  {
    purchaseId: 'cmnnshl0o000526o5tpzg0zeq',
    who: 'Marcela Chacón',
    action: 'GIFT',
    newProviderId: 'gift_manual',
    notes: 'Cortesía/regalo — Balance Pass (8 clases), confirmado por José 2026-04-09',
  },
  {
    // Esther Umanzor — 1 Clase 06-abr (distinguirla del trimestral del $800 que ya está excluido)
    purchaseMatch: { userName: 'Esther Umanzor', packageNameContains: '1 Clase', createdAfter: '2026-04-06T00:00:00Z' },
    who: 'Esther Umanzor',
    action: 'GIFT',
    newProviderId: 'gift_manual',
    notes: 'Cortesía/regalo — 1 Clase, confirmado por José 2026-04-09',
  },
  {
    purchaseId: 'cmnna3zgb0008aojollomra2l',
    who: 'Laura Rivas',
    action: 'GIFT',
    newProviderId: 'gift_manual',
    notes: 'Cortesía/regalo — Balance Pass (8 clases), confirmado por José 2026-04-09',
  },
] as const

async function resolvePurchaseId(fix: (typeof FIXES)[number]): Promise<string | null> {
  if ('purchaseId' in fix) return fix.purchaseId
  const match = fix.purchaseMatch
  const purchase = await prisma.purchase.findFirst({
    where: {
      paymentProviderId: null,
      user: { name: match.userName },
      createdAt: { gte: new Date(match.createdAfter) },
      ...('packageNameContains' in match
        ? { package: { name: { contains: match.packageNameContains } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return purchase?.id ?? null
}

async function main() {
  console.log('🔧 Fix de data: POS + GIFT purchases (abril 2026)\n')

  for (const fix of FIXES) {
    const purchaseId = await resolvePurchaseId(fix)
    if (!purchaseId) {
      console.log(`❌  ${fix.who}: no se encontró Purchase (ya actualizada o no existe)`)
      continue
    }

    const current = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { user: { select: { name: true, email: true } }, package: { select: { name: true, price: true } } },
    })
    if (!current) {
      console.log(`❌  ${fix.who}: Purchase ${purchaseId} desapareció`)
      continue
    }

    // Idempotencia: si ya tiene el providerId correcto, skip
    if (current.paymentProviderId === fix.newProviderId) {
      console.log(`⏭  ${fix.who}: ya está marcada como ${fix.newProviderId}, skip`)
      continue
    }

    // Verificación extra: solo actuamos si actualmente está null
    if (current.paymentProviderId !== null) {
      console.log(
        `⚠  ${fix.who}: Purchase ${purchaseId} tiene providerId="${current.paymentProviderId}" (esperaba null), skip por seguridad`
      )
      continue
    }

    if (fix.action === 'POS_PAYMENT') {
      // Actualiza finalPrice al precio del paquete y marca como pos_manual
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          finalPrice: fix.newFinalPrice,
          originalPrice: fix.newFinalPrice, // re-sync por si acaso
          paymentProviderId: fix.newProviderId,
        },
      })
      console.log(
        `✅  ${fix.who}: ${current.package.name} — $0 → $${fix.newFinalPrice.toFixed(2)} · ${fix.newProviderId}`
      )
    } else {
      // GIFT: solo marca el providerId, finalPrice queda en 0
      await prisma.purchase.update({
        where: { id: purchaseId },
        data: { paymentProviderId: fix.newProviderId },
      })
      console.log(`🎁  ${fix.who}: ${current.package.name} marcada como ${fix.newProviderId} (cortesía)`)
    }
  }

  console.log('\nListo.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
