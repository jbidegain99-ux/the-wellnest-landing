/**
 * Script para eliminar todos los paquetes (purchases) del usuario jbidegain@republicode.com
 * - Cancela reservas futuras y devuelve créditos (ya no aplica si se eliminan purchases)
 * - Elimina todos los Purchase records
 * - NO elimina el usuario
 *
 * Ejecutar con: npx tsx scripts/remove-user-packages.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_EMAIL = 'jbidegain@republicode.com'

async function removeUserPackages() {
  console.log(`=== Eliminar paquetes de ${TARGET_EMAIL} ===\n`)

  try {
    // 1. Find the user
    const user = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      include: {
        purchases: {
          include: {
            package: { select: { name: true } },
            reservations: {
              where: { status: 'CONFIRMED' },
              include: {
                class: {
                  include: { discipline: true },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      console.log(`Usuario ${TARGET_EMAIL} no encontrado.`)
      return
    }

    console.log(`Usuario encontrado: ${user.name} (${user.email}) - ID: ${user.id}`)
    console.log(`Purchases actuales: ${user.purchases.length}\n`)

    if (user.purchases.length === 0) {
      console.log('El usuario no tiene paquetes asignados.')
      return
    }

    for (const purchase of user.purchases) {
      const futureReservations = purchase.reservations.filter(
        r => new Date(r.class.dateTime) > new Date()
      )
      console.log(`  - [${purchase.id}] ${purchase.package.name}`)
      console.log(`    Status: ${purchase.status} | Clases restantes: ${purchase.classesRemaining}`)
      console.log(`    Reservas confirmadas futuras: ${futureReservations.length}`)
    }

    // 2. Cancel all future confirmed reservations
    const allFutureReservations = user.purchases.flatMap(p =>
      p.reservations.filter(r => new Date(r.class.dateTime) > new Date())
    )

    if (allFutureReservations.length > 0) {
      console.log(`\nCancelando ${allFutureReservations.length} reservas futuras...`)
      for (const res of allFutureReservations) {
        await prisma.reservation.update({
          where: { id: res.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        })
        console.log(`  Cancelada: ${res.class.discipline.name} - ${res.class.dateTime.toISOString()}`)
      }
    }

    // 3. Delete all reservations for this user's purchases (confirmed, cancelled, etc.)
    const purchaseIds = user.purchases.map(p => p.id)

    // Check for promo redemptions tied to these purchases
    const deletedPromoRedemptions = await prisma.promoRedemption.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    })
    if (deletedPromoRedemptions.count > 0) {
      console.log(`\nPromoRedemptions eliminados: ${deletedPromoRedemptions.count}`)
    }

    // Check for refund requests tied to these purchases
    const deletedRefundRequests = await prisma.refundRequest.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    })
    if (deletedRefundRequests.count > 0) {
      console.log(`RefundRequests eliminados: ${deletedRefundRequests.count}`)
    }

    // Check for referrals tied to these purchases
    const deletedReferrals = await prisma.referral.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    })
    if (deletedReferrals.count > 0) {
      console.log(`Referrals eliminados: ${deletedReferrals.count}`)
    }

    // Delete all reservations for these purchases
    const deletedReservations = await prisma.reservation.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    })
    console.log(`\nReservaciones eliminadas: ${deletedReservations.count}`)

    // 4. Delete all purchases
    const deletedPurchases = await prisma.purchase.deleteMany({
      where: { userId: user.id },
    })
    console.log(`Purchases eliminados: ${deletedPurchases.count}`)

    // 5. Verify
    const remainingPurchases = await prisma.purchase.count({
      where: { userId: user.id },
    })
    console.log(`\n=== Verificación ===`)
    console.log(`Purchases restantes para ${TARGET_EMAIL}: ${remainingPurchases}`)
    console.log(remainingPurchases === 0 ? 'OK - Usuario sin paquetes' : 'ERROR - Aún quedan paquetes')

  } catch (error) {
    console.error('Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

removeUserPackages()
