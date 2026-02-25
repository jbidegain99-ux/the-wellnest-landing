/**
 * Fix Special Balance (5 clases) package in the database
 * Run with: npx tsx scripts/fix-special-balance.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const slug = 'special-balance-5'

  // Find existing package
  const existing = await prisma.package.findFirst({ where: { slug } })

  if (!existing) {
    console.log(`Package with slug "${slug}" not found. Creating it...`)
    const lastPkg = await prisma.package.findFirst({ orderBy: { order: 'desc' } })
    const newOrder = (lastPkg?.order ?? 0) + 1

    await prisma.package.create({
      data: {
        slug,
        name: 'Special Balance (5 clases)',
        subtitle: 'Movimiento + Nutrición',
        shortDescription: 'Un paquete especial diseñado para acompañarte de forma integral.',
        fullDescription:
          'Un paquete especial diseñado para acompañarte de forma integral. Integra movimiento y nutrición para apoyar tu energía, tu equilibrio y tus objetivos de bienestar desde la raíz.',
        classCount: 5,
        price: 65.0,
        currency: 'USD',
        validityDays: 30,
        validityText: null,
        bulletsTop: [
          '5 clases de la disciplina que desees',
          '1 consulta nutricional personalizada',
          'Vigencia: 30 días',
        ],
        bulletsBottom: [
          'Acceso a todas las disciplinas',
          'Consulta nutricional enfocada en hábitos reales y sostenibles',
          'Ideal para iniciar o retomar tu proceso de bienestar',
        ],
        isActive: true,
        isFeatured: true,
        order: newOrder,
      },
    })
    console.log('Package created successfully!')
  } else {
    console.log(`Found package: ${existing.name} (id: ${existing.id})`)
    console.log('Current data:', {
      shortDescription: existing.shortDescription,
      bulletsTop: existing.bulletsTop,
      bulletsBottom: existing.bulletsBottom,
    })

    await prisma.package.update({
      where: { id: existing.id },
      data: {
        name: 'Special Balance (5 clases)',
        subtitle: 'Movimiento + Nutrición',
        shortDescription: 'Un paquete especial diseñado para acompañarte de forma integral.',
        fullDescription:
          'Un paquete especial diseñado para acompañarte de forma integral. Integra movimiento y nutrición para apoyar tu energía, tu equilibrio y tus objetivos de bienestar desde la raíz.',
        classCount: 5,
        price: 65.0,
        validityDays: 30,
        bulletsTop: [
          '5 clases de la disciplina que desees',
          '1 consulta nutricional personalizada',
          'Vigencia: 30 días',
        ],
        bulletsBottom: [
          'Acceso a todas las disciplinas',
          'Consulta nutricional enfocada en hábitos reales y sostenibles',
          'Ideal para iniciar o retomar tu proceso de bienestar',
        ],
        isActive: true,
        isFeatured: true,
      },
    })
    console.log('Package updated successfully!')
  }

  // Delete any duplicate packages with similar slugs
  const duplicates = await prisma.package.findMany({
    where: {
      slug: { startsWith: 'special-balance-5' },
      NOT: { slug },
    },
  })

  for (const dup of duplicates) {
    const purchases = await prisma.purchase.count({ where: { packageId: dup.id } })
    if (purchases === 0) {
      await prisma.package.delete({ where: { id: dup.id } })
      console.log(`Deleted duplicate: ${dup.slug} (id: ${dup.id})`)
    } else {
      await prisma.package.update({ where: { id: dup.id }, data: { isActive: false } })
      console.log(`Deactivated duplicate (has purchases): ${dup.slug} (id: ${dup.id})`)
    }
  }

  // Verify
  const updated = await prisma.package.findFirst({ where: { slug } })
  console.log('\nVerification:')
  console.log(JSON.stringify(updated, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
