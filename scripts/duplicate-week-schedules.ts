import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

async function duplicateWeekSchedules() {
  console.log('🔄 Duplicando horarios: Semana 9-14 → Semana 16-21\n')

  // PASO A: Obtener clases fuente (semana 9-14)
  // El Salvador UTC-6: Mar 9 00:00 SV = Mar 9 06:00 UTC
  const sourceClasses = await prisma.class.findMany({
    where: {
      dateTime: {
        gte: new Date('2026-03-09T06:00:00Z'),
        lt: new Date('2026-03-15T06:00:00Z'),
      },
    },
    orderBy: { dateTime: 'asc' },
  })

  console.log(`📋 Semana 9-14: ${sourceClasses.length} clases encontradas`)

  if (sourceClasses.length === 0) {
    console.error('❌ No hay clases en semana 9-14. Abortando.')
    return
  }

  // PASO B: Verificar reservaciones en semana 16-21 antes de eliminar
  const targetClasses = await prisma.class.findMany({
    where: {
      dateTime: {
        gte: new Date('2026-03-16T06:00:00Z'),
        lt: new Date('2026-03-22T06:00:00Z'),
      },
    },
    include: { _count: { select: { reservations: true } } },
  })

  const withReservations = targetClasses.filter(c => c._count.reservations > 0)
  if (withReservations.length > 0) {
    console.error(`❌ ${withReservations.length} clases en semana 16-21 tienen reservaciones. Abortando.`)
    for (const c of withReservations) {
      console.error(`   ID: ${c.id} — ${c._count.reservations} reservaciones`)
    }
    return
  }

  console.log(`🗑️  Semana 16-21: ${targetClasses.length} clases a eliminar (0 con reservaciones)`)

  // PASO C: Eliminar semana 16-21
  const deleted = await prisma.class.deleteMany({
    where: {
      dateTime: {
        gte: new Date('2026-03-16T06:00:00Z'),
        lt: new Date('2026-03-22T06:00:00Z'),
      },
    },
  })

  console.log(`   Eliminadas: ${deleted.count}\n`)

  // PASO D: Copiar semana 9-14 → 16-21 (dateTime + 7 días)
  console.log('📝 Creando copias (+7 días)...\n')

  let created = 0
  for (const src of sourceClasses) {
    const newDateTime = new Date(src.dateTime.getTime() + SEVEN_DAYS_MS)

    await prisma.class.create({
      data: {
        disciplineId: src.disciplineId,
        complementaryDisciplineId: src.complementaryDisciplineId,
        instructorId: src.instructorId,
        dateTime: newDateTime,
        duration: src.duration,
        maxCapacity: src.maxCapacity,
        currentCount: 0,
        isRecurring: src.isRecurring,
        recurringPattern: src.recurringPattern,
        isCancelled: false,
        classType: src.classType,
        notes: src.notes,
      },
    })

    const svTime = new Date(newDateTime.getTime() - 6 * 60 * 60 * 1000)
    console.log(`  ✓ ${svTime.toISOString().slice(0, 10)} ${svTime.toISOString().slice(11, 16)} | ${src.classType || 'regular'}`)
    created++
  }

  console.log(`\n✅ Creadas ${created} clases en semana 16-21`)

  // PASO E: Verificación final
  const week9Count = await prisma.class.count({
    where: {
      dateTime: {
        gte: new Date('2026-03-09T06:00:00Z'),
        lt: new Date('2026-03-15T06:00:00Z'),
      },
    },
  })

  const week16Count = await prisma.class.count({
    where: {
      dateTime: {
        gte: new Date('2026-03-16T06:00:00Z'),
        lt: new Date('2026-03-22T06:00:00Z'),
      },
    },
  })

  console.log('\n📊 VERIFICACIÓN:')
  console.log(`   Semana 9-14:  ${week9Count} clases`)
  console.log(`   Semana 16-21: ${week16Count} clases`)

  if (week9Count === week16Count) {
    console.log('\n✨ ¡Duplicación completada exitosamente!')
    console.log('   Semana 16-21 ahora es idéntica a semana 9-14 (con fechas +7 días)')
  } else {
    console.warn('\n⚠️  Las cantidades no coinciden. Verifica en Prisma Studio.')
  }

  await prisma.$disconnect()
}

duplicateWeekSchedules().catch((e) => {
  console.error('❌ Error:', e)
  process.exit(1)
})
