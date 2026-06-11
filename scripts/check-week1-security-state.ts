/**
 * Chequeo SOLO LECTURA del estado de producción previo a los fixes de Semana 1:
 * 1. Duplicados en Purchase.paymentProviderId (bloquearían el índice único)
 * 2. Códigos de descuento sembrados (GRATIS100/WELCOME10/PRIMERA20)
 * 3. Cuentas sembradas (admin@thewellnest.sv, test@example.com) y si conservan
 *    las contraseñas hardcodeadas del seed (admin123 / test123)
 *
 * No ejecuta ningún write.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 1. Duplicados de paymentProviderId
  const dups = await prisma.$queryRaw<Array<{ stripePaymentId: string; count: bigint }>>`
    SELECT "stripePaymentId", COUNT(*) as count
    FROM "Purchase"
    WHERE "stripePaymentId" IS NOT NULL
    GROUP BY "stripePaymentId"
    HAVING COUNT(*) > 1
  `
  console.log('=== 1. Duplicados de paymentProviderId ===')
  if (dups.length === 0) {
    console.log('OK: sin duplicados — el índice único se puede crear.')
  } else {
    for (const d of dups) {
      console.log(`DUP: ${d.stripePaymentId} x${d.count}`)
      const rows = await prisma.purchase.findMany({
        where: { paymentProviderId: d.stripePaymentId },
        select: {
          id: true, userId: true, packageId: true, createdAt: true,
          finalPrice: true, classesRemaining: true, status: true,
          user: { select: { email: true } },
          package: { select: { name: true } },
        },
      })
      for (const r of rows) {
        console.log(
          `  - ${r.id} | ${r.user.email} | ${r.package.name} | $${r.finalPrice} | ` +
          `restantes=${r.classesRemaining} | ${r.status} | ${r.createdAt.toISOString()}`
        )
      }
    }
  }

  // 2. Códigos de descuento sembrados
  console.log('\n=== 2. Códigos de descuento del seed ===')
  const codes = await prisma.discountCode.findMany({
    where: { code: { in: ['GRATIS100', 'WELCOME10', 'PRIMERA20'] } },
    select: {
      code: true, percentage: true, maxUses: true, currentUses: true,
      isActive: true, validUntil: true,
      _count: { select: { redemptions: true } },
    },
  })
  if (codes.length === 0) console.log('Ninguno existe en la base.')
  for (const c of codes) {
    console.log(
      `${c.code}: ${c.percentage}% | usos ${c.currentUses}/${c.maxUses} | ` +
      `redenciones=${c._count.redemptions} | activo=${c.isActive} | vence=${c.validUntil.toISOString()}`
    )
  }

  // 3. Cuentas sembradas
  console.log('\n=== 3. Cuentas del seed ===')
  const seedUsers = await prisma.user.findMany({
    where: { email: { in: ['admin@thewellnest.sv', 'test@example.com'] } },
    select: {
      id: true, email: true, role: true, password: true, createdAt: true,
      _count: { select: { purchases: true, reservations: true } },
    },
  })
  if (seedUsers.length === 0) console.log('Ninguna existe en la base.')
  for (const u of seedUsers) {
    const knownPasswords = ['admin123', 'test123']
    let weak = 'no'
    for (const p of knownPasswords) {
      if (u.password && (await bcrypt.compare(p, u.password))) {
        weak = `SÍ ("${p}")`
        break
      }
    }
    console.log(
      `${u.email} | rol=${u.role} | compras=${u._count.purchases} | ` +
      `reservas=${u._count.reservations} | creado=${u.createdAt.toISOString()} | contraseña hardcodeada: ${weak}`
    )
  }

  // 4. Total de purchases con paymentProviderId null (referencia)
  const nullCount = await prisma.purchase.count({ where: { paymentProviderId: null } })
  const totalCount = await prisma.purchase.count()
  console.log(`\n(Referencia: ${totalCount} purchases, ${nullCount} con paymentProviderId null — los null no afectan el índice único)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
