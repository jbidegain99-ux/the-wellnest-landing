/**
 * Acredita un pago PayWay cuyo callback falló en el servidor (la tarjeta SÍ se
 * cobró pero la Order quedó PENDING y no se creó la Purchase).
 *
 * El callback manda a los admins un correo "Pago PayWay cobrado sin acreditar"
 * con un JSON; guardarlo en un archivo y pasarlo a este script. Antes de
 * aplicar, confirmar el cobro en el banco (monto, tarjeta, hora).
 *
 * Reutiliza markOrderPaidAndCreatePurchase (mismo camino que el callback real):
 * marca la Order PAID, crea PaymentTransaction APPROVED + Purchase y la envía a
 * facturar. Es idempotente: si la Order ya está PAID no hace nada.
 *
 * Primer uso: 2026-10-01, Matilde Delgado (orden cmuqc53wv0009xdc9igar48ne),
 * callback caído por "too many connections for role prisma_migration".
 *
 * Uso:
 *   npx tsx scripts/recover-lost-payway-callback.ts pago.json           # dry-run
 *   npx tsx scripts/recover-lost-payway-callback.ts pago.json --apply   # escribe
 */

import './loadEnv'
import * as fs from 'fs'
import type { PaywayRecoveryPayload } from '../src/lib/payments/paywayRecovery'

async function main() {
  const file = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!file || file.startsWith('--')) {
    console.error('Uso: npx tsx scripts/recover-lost-payway-callback.ts <pago.json> [--apply]')
    process.exit(1)
  }

  const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as PaywayRecoveryPayload
  const orderId = payload.oid
  if (!orderId) throw new Error('El JSON no trae "oid"')
  if (!payload.pwoAuthorizationNumber) throw new Error('Sin pwoAuthorizationNumber no hay prueba de cobro')

  const { prisma } = await import('../src/lib/prisma')
  const { markOrderPaidAndCreatePurchase } = await import('../src/lib/payments/markOrderPaid')
  const { recoveryTransactionData } = await import('../src/lib/payments/paywayRecovery')

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { package: { select: { name: true } } } },
        transactions: { select: { status: true, authorizationNumber: true } },
      },
    })
    if (!order) throw new Error(`Order ${orderId} no existe`)

    console.log('Order:', {
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      user: `${order.user.name} <${order.user.email}>`,
      items: order.items.map((i) => `${i.quantity}x ${i.package.name} @ $${i.unitPrice}`),
      transactions: order.transactions,
    })
    console.log('PayWay:', payload)

    if (order.status !== 'PENDING') {
      console.log(`Order ya está ${order.status}; nada que hacer.`)
      return
    }

    if (!apply) {
      console.log('\nDRY-RUN: se marcaría PAID y se crearía la Purchase. Verificar el cobro en el banco y correr con --apply.')
      return
    }

    const result = await markOrderPaidAndCreatePurchase({
      orderId,
      provider: 'PAYWAY',
      transactionData: {
        ...recoveryTransactionData(payload),
        rawPayload: {
          ...payload,
          recoveredManually: true,
          recoveredAt: new Date().toISOString(),
        },
      },
    })
    console.log('\nResultado:', JSON.stringify(result, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
