import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create disciplines
  const disciplines = await Promise.all([
    prisma.discipline.upsert({
      where: { slug: 'yoga' },
      update: {},
      create: {
        name: 'Yoga',
        slug: 'yoga',
        description:
          'El yoga es una práctica milenaria que une cuerpo, mente y espíritu a través de posturas físicas, técnicas de respiración y meditación.',
        benefits:
          'Mejora la flexibilidad y fuerza muscular, reduce el estrés y la ansiedad, aumenta la concentración y claridad mental.',
        order: 1,
      },
    }),
    prisma.discipline.upsert({
      where: { slug: 'pilates' },
      update: {},
      create: {
        name: 'Pilates Mat',
        slug: 'pilates',
        description:
          'Pilates Mat se practica en colchoneta y se enfoca en el fortalecimiento del core, la mejora de la postura y la alineación corporal.',
        benefits:
          'Fortalece los músculos profundos del core, mejora la postura y alineación corporal, aumenta la flexibilidad de forma segura.',
        order: 2,
      },
    }),
    prisma.discipline.upsert({
      where: { slug: 'pole' },
      update: {},
      create: {
        name: 'Pole Sport',
        slug: 'pole',
        description:
          'Pole Sport combina danza, acrobacia y fitness en una disciplina que desarrolla fuerza, flexibilidad y confianza.',
        benefits:
          'Desarrolla fuerza funcional completa, mejora la coordinación y equilibrio, aumenta la confianza y autoestima.',
        order: 3,
      },
    }),
    prisma.discipline.upsert({
      where: { slug: 'soundhealing' },
      update: {},
      create: {
        name: 'Sound Healing',
        slug: 'soundhealing',
        description:
          'Sound Healing es una experiencia meditativa donde te sumerges en frecuencias sanadoras producidas por cuencos tibetanos y otros instrumentos.',
        benefits:
          'Reduce el estrés profundamente, promueve la relajación, mejora la calidad del sueño, equilibra el sistema nervioso.',
        order: 4,
      },
    }),
    prisma.discipline.upsert({
      where: { slug: 'nutricion' },
      update: {},
      create: {
        name: 'Nutrición',
        slug: 'nutricion',
        description:
          'Consultas de nutrición personalizadas para mejorar tu alimentación y alcanzar tus objetivos de bienestar.',
        benefits:
          'Plan alimenticio personalizado, mejora tu relación con la comida, aumenta tu energía y vitalidad.',
        order: 5,
      },
    }),
  ])

  console.log('Created disciplines:', disciplines.length)

  // Create instructors
  const instructors = await Promise.all([
    prisma.instructor.upsert({
      where: { id: 'instructor-1' },
      update: {},
      create: {
        id: 'instructor-1',
        name: 'María García',
        bio: 'Con más de 10 años de práctica y 5 como instructora certificada, María combina su pasión por el yoga con su visión de crear un espacio de bienestar integral.',
        disciplines: ['Yoga', 'Sound Healing'],
        order: 1,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-2' },
      update: {},
      create: {
        id: 'instructor-2',
        name: 'Ana Martínez',
        bio: 'Certificada en Pilates Mat por BASI, Ana se especializa en alineación corporal y rehabilitación postural.',
        disciplines: ['Pilates Mat'],
        order: 2,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-3' },
      update: {},
      create: {
        id: 'instructor-3',
        name: 'Carolina López',
        bio: 'Bailarina profesional y campeona nacional de Pole Sport, Carolina crea un ambiente empoderador.',
        disciplines: ['Pole Sport'],
        order: 3,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-4' },
      update: {},
      create: {
        id: 'instructor-4',
        name: 'Sofía Hernández',
        bio: 'Formada en Nepal y certificada en terapia de sonido, Sofía guía experiencias de Soundbath.',
        disciplines: ['Sound Healing'],
        order: 4,
      },
    }),
  ])

  console.log('Created instructors:', instructors.length)

  // Create packages
  const packages = await Promise.all([
    prisma.package.upsert({
      where: { id: 'package-1' },
      update: {},
      create: {
        id: 'package-1',
        name: '1 Clase',
        shortDescription: 'Ideal para probar',
        fullDescription:
          'Perfecto para conocer nuestro estudio o para quienes tienen horarios muy flexibles.',
        classCount: 1,
        price: 15,
        validityDays: 30,
        order: 1,
      },
    }),
    prisma.package.upsert({
      where: { id: 'package-2' },
      update: {},
      create: {
        id: 'package-2',
        name: '4 Clases',
        shortDescription: 'Una vez por semana',
        fullDescription:
          'El paquete perfecto para mantener una práctica semanal constante.',
        classCount: 4,
        price: 50,
        validityDays: 45,
        order: 2,
      },
    }),
    prisma.package.upsert({
      where: { id: 'package-3' },
      update: {},
      create: {
        id: 'package-3',
        name: '8 Clases',
        shortDescription: 'Dos veces por semana',
        fullDescription:
          'Duplica tu práctica y acelera tus resultados. Perfecto para quienes quieren profundizar.',
        classCount: 8,
        price: 90,
        validityDays: 60,
        isFeatured: true,
        order: 3,
      },
    }),
    prisma.package.upsert({
      where: { id: 'package-4' },
      update: {},
      create: {
        id: 'package-4',
        name: '12 Clases',
        shortDescription: 'Tres veces por semana',
        fullDescription:
          'Para los comprometidos con su bienestar. Máxima flexibilidad para combinar disciplinas.',
        classCount: 12,
        price: 120,
        validityDays: 60,
        order: 4,
      },
    }),
    prisma.package.upsert({
      where: { id: 'package-5' },
      update: {},
      create: {
        id: 'package-5',
        name: 'Mensual Ilimitado',
        shortDescription: 'Sin límites',
        fullDescription:
          'Clases ilimitadas durante un mes completo. La libertad total.',
        classCount: 999,
        price: 150,
        validityDays: 30,
        order: 6,
      },
    }),
  ])

  console.log('Created packages:', packages.length)

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@thewellnest.sv' },
    update: {},
    create: {
      email: 'admin@thewellnest.sv',
      name: 'Admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('Created admin user:', adminUser.email)

  // Create sample discount code
  await prisma.discountCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      percentage: 10,
      maxUses: 100,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('Created discount code: WELCOME10')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
