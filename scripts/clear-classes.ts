/**
 * Script para borrar todas las clases del sistema
 * Ejecutar con: npx ts-node scripts/clear-classes.ts
 * O: npx tsx scripts/clear-classes.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearAllClasses() {
  console.log('🗑️  Iniciando limpieza de clases...\n')

  try {
    // Primero, contar cuántas hay
    const classCount = await prisma.class.count()
    const reservationCount = await prisma.reservation.count()
    const waitlistCount = await prisma.waitlist.count()

    console.log(`📊 Estado actual:`)
    console.log(`   - Clases: ${classCount}`)
    console.log(`   - Reservaciones: ${reservationCount}`)
    console.log(`   - Lista de espera: ${waitlistCount}\n`)

    if (classCount === 0) {
      console.log('✅ No hay clases que borrar. La base de datos ya está limpia.')
      return
    }

    // Borrar waitlist primero (por la FK)
    const deletedWaitlist = await prisma.waitlist.deleteMany({})
    console.log(`🗑️  Eliminadas ${deletedWaitlist.count} entradas de lista de espera`)

    // Borrar reservaciones (por la FK)
    const deletedReservations = await prisma.reservation.deleteMany({})
    console.log(`🗑️  Eliminadas ${deletedReservations.count} reservaciones`)

    // Borrar todas las clases
    const deletedClasses = await prisma.class.deleteMany({})
    console.log(`🗑️  Eliminadas ${deletedClasses.count} clases`)

    console.log('\n✅ ¡Limpieza completada exitosamente!')
    console.log('   El sistema está listo para que los usuarios creen nuevas clases.')

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearAllClasses()
