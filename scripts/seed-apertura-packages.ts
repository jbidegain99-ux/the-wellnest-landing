import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Seeding Apertura Packages ===\n')

  // 1. Deactivate all current packages EXCEPT Trimestral
  const deactivated = await prisma.package.updateMany({
    where: {
      isActive: true,
      slug: { not: 'wellnest-trimestral-80' },
    },
    data: { isActive: false },
  })
  console.log(`Deactivated ${deactivated.count} packages (Trimestral kept active)\n`)

  // 2. Create apertura packages
  const aperturaPackages = [
    {
      slug: 'apertura-mini-flow-4',
      name: 'Mini Flow (4 clases)',
      subtitle: 'Una pausa semanal para reconectar',
      shortDescription: 'Una pausa semanal para reconectar',
      fullDescription:
        'Un paquete suave y accesible para iniciar tu camino de bienestar, crear constancia y sentir el movimiento como medicina.',
      classCount: 4,
      price: 42.49,
      originalPrice: 49.99,
      discountPercent: 15,
      currency: 'USD',
      validityDays: 30,
      bulletsTop: ['4 clases', '30 días de vigencia'],
      bulletsBottom: [
        'Ideal para comenzar',
        'Todas las disciplinas incluidas',
        'Reserva fácil desde la app',
        'Cancela tu clase 8 horas antes',
      ],
      isFeatured: false,
      isActive: true,
      order: 1,
    },
    {
      slug: 'apertura-balance-pass-8',
      name: 'Balance Pass (8 clases)',
      subtitle: 'Encuentra tu ritmo y sosténlo',
      shortDescription: 'Encuentra tu ritmo y sosténlo',
      fullDescription:
        'Diseñado para quienes desean integrar el movimiento consciente como parte de su semana y equilibrar cuerpo y mente.',
      classCount: 8,
      price: 59.49,
      originalPrice: 69.99,
      discountPercent: 15,
      currency: 'USD',
      validityDays: 30,
      bulletsTop: ['8 clases', '30 días de vigencia'],
      bulletsBottom: [
        'Dos veces por semana',
        'Acceso a todas las disciplinas',
        'Flexibilidad total de horarios',
        'Cancela tu clase 8 horas antes',
      ],
      isFeatured: true,
      isActive: true,
      order: 2,
    },
    {
      slug: 'apertura-energia-total-12',
      name: 'Energía Total (12 clases)',
      subtitle: 'Movimiento constante, energía en expansión',
      shortDescription: 'Movimiento constante, energía en expansión',
      fullDescription:
        'Un impulso energético para quienes buscan mayor presencia, fuerza y conexión interior a través del movimiento regular.',
      classCount: 12,
      price: 76.0,
      originalPrice: 95.0,
      discountPercent: 20,
      currency: 'USD',
      validityDays: 30,
      bulletsTop: ['12 clases', '30 días de vigencia'],
      bulletsBottom: [
        'Ideal para crear hábito',
        'Todas las disciplinas incluidas',
        'Reserva desde la app',
        'Cancela tu clase 8 horas antes',
      ],
      isFeatured: false,
      isActive: true,
      order: 3,
    },
    {
      slug: 'apertura-vital-plan-16',
      name: 'Vital Plan (16 clases)',
      subtitle: 'Tu bienestar como prioridad',
      shortDescription: 'Tu bienestar como prioridad',
      fullDescription:
        'Pensado para quienes eligen sostener su bienestar con intención, constancia y variedad de disciplinas.',
      classCount: 16,
      price: 92.0,
      originalPrice: 115.0,
      discountPercent: 20,
      currency: 'USD',
      validityDays: 30,
      bulletsTop: ['16 clases', '30 días de vigencia'],
      bulletsBottom: [
        'Hasta 4 clases por semana',
        'Movimiento consciente y flexible',
        'Acompaña tu ritmo de vida',
        'Cancela tu clase 8 horas antes',
      ],
      isFeatured: false,
      isActive: true,
      order: 4,
    },
    {
      slug: 'apertura-full-access-24',
      name: 'Full Access (24 clases)',
      subtitle: 'Compromiso profundo con tu bienestar',
      shortDescription: 'Compromiso profundo con tu bienestar',
      fullDescription:
        'Nuestro plan más completo para quienes desean integrar el movimiento como un estilo de vida consciente y presente en día a día.',
      classCount: 24,
      price: 101.5,
      originalPrice: 145.0,
      discountPercent: 30,
      currency: 'USD',
      validityDays: 35,
      bulletsTop: ['24 clases', '35 días de vigencia'],
      bulletsBottom: [
        'Máxima flexibilidad',
        'Acceso total a disciplinas',
        'Ideal para rutinas activas',
        'Cancela tu clase 8 horas antes',
      ],
      isFeatured: false,
      isActive: true,
      order: 5,
    },
  ]

  // Update Trimestral order to come after apertura packages
  await prisma.package.updateMany({
    where: { slug: 'wellnest-trimestral-80' },
    data: { order: 6 },
  })

  for (const pkg of aperturaPackages) {
    const created = await prisma.package.create({ data: pkg })
    console.log(`Created: ${created.name} → $${created.price} (was $${created.originalPrice}, ${created.discountPercent}% OFF)`)
  }

  console.log('\nDone! Apertura packages seeded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
