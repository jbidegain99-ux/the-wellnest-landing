/**
 * Script para eliminar clases del 1 y 2 de marzo 2026
 * - Devuelve créditos a usuarios con reservas confirmadas
 * - Cancela reservaciones
 * - Elimina waitlist
 * - Elimina las clases
 *
 * Ejecutar con: npx tsx scripts/cleanup-march-classes.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupMarchClasses() {
  console.log('=== Limpieza de clases 1-2 marzo 2026 ===\n')

  const startDate = new Date('2026-03-01T00:00:00.000Z')
  const endDate = new Date('2026-03-03T00:00:00.000Z') // exclusive

  try {
    // 1. Find all classes in the date range
    const classes = await prisma.class.findMany({
      where: {
        dateTime: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        discipline: true,
        instructor: true,
        reservations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: { select: { id: true, email: true, name: true } },
            purchase: { select: { id: true, classesRemaining: true, status: true, package: { select: { name: true } } } },
          },
        },
        waitlist: true,
      },
    })

    if (classes.length === 0) {
      console.log('No se encontraron clases para el 1 y 2 de marzo 2026.')
      return
    }

    console.log(`Encontradas ${classes.length} clases:\n`)
    for (const c of classes) {
      console.log(`  - [${c.id}] ${c.discipline.name} | ${c.dateTime.toISOString()} | Instructor: ${c.instructor.name}`)
      console.log(`    Reservas confirmadas: ${c.reservations.length} | Waitlist: ${c.waitlist.length}`)
    }

    const classIds = classes.map(c => c.id)
    const allReservations = classes.flatMap(c => c.reservations)

    console.log(`\nTotal reservas confirmadas a cancelar: ${allReservations.length}`)

    // 2. Refund credits for each confirmed reservation
    if (allReservations.length > 0) {
      console.log('\nDevolviendo créditos...')
      for (const res of allReservations) {
        await prisma.$transaction([
          // Cancel the reservation
          prisma.reservation.update({
            where: { id: res.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          }),
          // Refund 1 credit to the purchase
          prisma.purchase.update({
            where: { id: res.purchaseId },
            data: {
              classesRemaining: { increment: 1 },
              // Reactivate if it was depleted
              ...(res.purchase.status === 'DEPLETED' ? { status: 'ACTIVE' } : {}),
            },
          }),
        ])
        console.log(`  Crédito devuelto: ${res.user.email} (${res.user.name}) - Paquete: ${res.purchase.package.name}`)
      }
    }

    // 3. Delete waitlist entries
    const deletedWaitlist = await prisma.waitlist.deleteMany({
      where: { classId: { in: classIds } },
    })
    console.log(`\nWaitlist eliminados: ${deletedWaitlist.count}`)

    // 4. Delete remaining reservations (CANCELLED ones, or any other status)
    const deletedReservations = await prisma.reservation.deleteMany({
      where: { classId: { in: classIds } },
    })
    console.log(`Reservaciones eliminadas: ${deletedReservations.count}`)

    // 5. Delete the classes
    const deletedClasses = await prisma.class.deleteMany({
      where: { id: { in: classIds } },
    })
    console.log(`Clases eliminadas: ${deletedClasses.count}`)

    console.log('\n=== Limpieza completada ===')
    console.log(`Resumen:`)
    console.log(`  Clases eliminadas: ${deletedClasses.count}`)
    console.log(`  Reservas canceladas con crédito devuelto: ${allReservations.length}`)
    console.log(`  Waitlist eliminados: ${deletedWaitlist.count}`)

  } catch (error) {
    console.error('Error durante la limpieza:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanupMarchClasses()
