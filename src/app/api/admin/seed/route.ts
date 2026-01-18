import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { addDays, startOfDay } from 'date-fns'

// El Salvador is UTC-6. To store times that display correctly for El Salvador users,
// we need to add 6 hours to the desired local time to get UTC.
const EL_SALVADOR_UTC_OFFSET = 6

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
          order: 2,
        },
      }),
      prisma.discipline.upsert({
        where: { slug: 'pilates' },
        update: {},
        create: {
          name: 'Mat Pilates',
          slug: 'pilates',
          description:
            'Pilates Mat se practica en colchoneta y se enfoca en el fortalecimiento del core, la mejora de la postura y la alineación corporal.',
          benefits:
            'Fortalece los músculos profundos del core, mejora la postura y alineación corporal, aumenta la flexibilidad de forma segura.',
          order: 1,
        },
      }),
      prisma.discipline.upsert({
        where: { slug: 'pole' },
        update: { name: 'Pole Fitness' },
        create: {
          name: 'Pole Fitness',
          slug: 'pole',
          description:
            'Pole Fitness combina danza, acrobacia y fitness en una disciplina que desarrolla fuerza, flexibilidad y confianza.',
          benefits:
            'Desarrolla fuerza funcional completa, mejora la coordinación y equilibrio, aumenta la confianza y autoestima.',
          order: 3,
        },
      }),
      prisma.discipline.upsert({
        where: { slug: 'soundbath' },
        update: { name: 'Terapia de Sonido', slug: 'terapia-de-sonido' },
        create: {
          name: 'Terapia de Sonido',
          slug: 'terapia-de-sonido',
          description:
            'Terapia de Sonido es una experiencia meditativa donde te sumerges en frecuencias sanadoras producidas por cuencos tibetanos y otros instrumentos.',
          benefits:
            'Reduce el estrés profundamente, promueve la relajación, mejora la calidad del sueño, equilibra el sistema nervioso.',
          order: 4,
        },
      }),
      prisma.discipline.upsert({
        where: { slug: 'nutricion' },
        update: {},
        create: {
          name: 'Nutrition',
          slug: 'nutricion',
          description:
            'Consultas de nutrición personalizadas para mejorar tu alimentación y alcanzar tus objetivos de bienestar.',
          benefits:
            'Plan alimenticio personalizado, mejora tu relación con la comida, aumenta tu energía y vitalidad.',
          order: 5,
        },
      }),
    ])

    // Create instructors
    const instructors = await Promise.all([
      prisma.instructor.upsert({
        where: { id: 'instructor-nicole' },
        update: {},
        create: {
          id: 'instructor-nicole',
          name: 'Nicole Soundy',
          bio: 'Co-fundadora de wellnest. Certificada en Yoga y Terapia de Sonido. Con más de 8 años de experiencia guiando prácticas de bienestar integral.',
          disciplines: ['Yoga', 'Terapia de Sonido'],
          order: 1,
        },
      }),
      prisma.instructor.upsert({
        where: { id: 'instructor-florence' },
        update: {},
        create: {
          id: 'instructor-florence',
          name: 'Florence Cervantes',
          bio: 'Instructora certificada en Mat Pilates por BASI. Especialista en alineación corporal y rehabilitación postural.',
          disciplines: ['Mat Pilates'],
          order: 2,
        },
      }),
      prisma.instructor.upsert({
        where: { id: 'instructor-adriana' },
        update: {},
        create: {
          id: 'instructor-adriana',
          name: 'Adriana Lopez',
          bio: 'Instructora de Pole con certificación internacional. Crea un ambiente empoderador y seguro para todos los niveles.',
          disciplines: ['Pole'],
          order: 3,
        },
      }),
      prisma.instructor.upsert({
        where: { id: 'instructor-denisse' },
        update: {},
        create: {
          id: 'instructor-denisse',
          name: 'Denisse Soundy',
          bio: 'Co-fundadora de wellnest. Instructora de Yoga y facilitadora de Sound Bath. Apasionada por el bienestar holístico.',
          disciplines: ['Yoga', 'Sound Bath'],
          order: 4,
        },
      }),
      prisma.instructor.upsert({
        where: { id: 'instructor-kevin' },
        update: {},
        create: {
          id: 'instructor-kevin',
          name: 'Kevin Cano',
          bio: 'Nutriólogo certificado. Especialista en nutrición deportiva y planes alimenticios personalizados para bienestar integral.',
          disciplines: ['Nutrition'],
          order: 5,
        },
      }),
    ])

    // Create packages (with slugs for new schema)
    const packages = await Promise.all([
      prisma.package.upsert({
        where: { slug: 'drop-in-class' },
        update: {},
        create: {
          slug: 'drop-in-class',
          name: 'Drop-In Class',
          subtitle: 'Ideal para fluir a tu propio ritmo',
          shortDescription: 'Perfecta para regalarte un momento consciente',
          fullDescription:
            'Perfecta para regalarte un momento consciente, probar una disciplina o adaptarte a semanas con horarios cambiantes.',
          classCount: 1,
          price: 10,
          validityDays: 5,
          bulletsTop: ['1 clase', '5 días de vigencia'],
          bulletsBottom: ['Válida para todas las disciplinas', 'Reserva desde la app', 'Cancela tu clase 8 horas antes'],
          order: 1,
        },
      }),
      prisma.package.upsert({
        where: { slug: 'mini-flow-4' },
        update: {},
        create: {
          slug: 'mini-flow-4',
          name: 'Mini Flow (4 clases)',
          subtitle: 'Una pausa semanal para reconectar',
          shortDescription: 'Un paquete suave y accesible',
          fullDescription:
            'Un paquete suave y accesible para iniciar tu camino de bienestar, crear constancia y sentir el movimiento como medicina.',
          classCount: 4,
          price: 49.99,
          validityDays: 30,
          bulletsTop: ['4 clases', '30 días de vigencia'],
          bulletsBottom: ['Ideal para comenzar', 'Todas las disciplinas incluidas', 'Reserva fácil desde la app', 'Cancela tu clase 8 horas antes'],
          order: 2,
        },
      }),
      prisma.package.upsert({
        where: { slug: 'balance-pass-8' },
        update: {},
        create: {
          slug: 'balance-pass-8',
          name: 'Balance Pass (8 clases)',
          subtitle: 'Encuentra tu ritmo y sosténlo',
          shortDescription: 'Dos veces por semana',
          fullDescription:
            'Diseñado para quienes desean integrar el movimiento consciente como parte de su semana y equilibrar cuerpo y mente.',
          classCount: 8,
          price: 69.99,
          validityDays: 30,
          bulletsTop: ['8 clases', '30 días de vigencia'],
          bulletsBottom: ['Dos veces por semana', 'Acceso a todas las disciplinas', 'Flexibilidad total de horarios', 'Cancela tu clase 8 horas antes'],
          isFeatured: true,
          order: 3,
        },
      }),
      prisma.package.upsert({
        where: { slug: 'energia-total-12' },
        update: {},
        create: {
          slug: 'energia-total-12',
          name: 'Energía Total (12 clases)',
          subtitle: 'Movimiento constante, energía en expansión',
          shortDescription: 'Tres veces por semana',
          fullDescription:
            'Un impulso energético para quienes buscan mayor presencia, fuerza y conexión interior a través del movimiento regular.',
          classCount: 12,
          price: 95,
          validityDays: 30,
          bulletsTop: ['12 clases', '30 días de vigencia'],
          bulletsBottom: ['Ideal para crear hábito', 'Todas las disciplinas incluidas', 'Reserva desde la app', 'Cancela tu clase 8 horas antes'],
          order: 4,
        },
      }),
      prisma.package.upsert({
        where: { slug: 'vital-plan-16' },
        update: {},
        create: {
          slug: 'vital-plan-16',
          name: 'Vital Plan (16 clases)',
          subtitle: 'Tu bienestar como prioridad',
          shortDescription: 'Hasta 4 clases por semana',
          fullDescription:
            'Pensado para quienes eligen sostener su bienestar con intención, constancia y variedad de disciplinas.',
          classCount: 16,
          price: 115,
          validityDays: 30,
          bulletsTop: ['16 clases', '30 días de vigencia'],
          bulletsBottom: ['Hasta 4 clases por semana', 'Movimiento consciente y flexible', 'Acompaña tu ritmo de vida', 'Cancela tu clase 8 horas antes'],
          order: 5,
        },
      }),
    ])

    // Create discount codes
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

    await prisma.discountCode.upsert({
      where: { code: 'PRIMERA20' },
      update: {},
      create: {
        code: 'PRIMERA20',
        percentage: 20,
        maxUses: 50,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    })

    // 100% discount code for testing free orders
    await prisma.discountCode.upsert({
      where: { code: 'GRATIS100' },
      update: {},
      create: {
        code: 'GRATIS100',
        percentage: 100,
        maxUses: 1000,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })

    // Get discipline and instructor references
    const yoga = disciplines.find((d) => d.slug === 'yoga')!
    const pilates = disciplines.find((d) => d.slug === 'pilates')!
    const pole = disciplines.find((d) => d.slug === 'pole')!
    const terapiaDeSonido = disciplines.find((d) => d.slug === 'terapia-de-sonido' || d.slug === 'soundbath')!

    const nicole = instructors.find((i) => i.name === 'Nicole Soundy')!
    const florence = instructors.find((i) => i.name === 'Florence Cervantes')!
    const adriana = instructors.find((i) => i.name === 'Adriana Lopez')!
    const denisse = instructors.find((i) => i.name === 'Denisse Soundy')!

    // Delete existing classes to avoid duplicates
    await prisma.class.deleteMany({})

    // Create classes for the next 90 days (3 months of coverage)
    const today = startOfDay(new Date())
    const classesToCreate: Array<{
      disciplineId: string
      instructorId: string
      dateTime: Date
      duration: number
      maxCapacity: number
    }> = []

    // Weekly schedule template (0 = Sunday, 1 = Monday, etc.)
    const weeklySchedule = [
      // Monday
      { day: 1, hour: 6, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 1, hour: 8, minute: 0, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 1, hour: 17, minute: 30, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      { day: 1, hour: 19, minute: 0, discipline: yoga, instructor: denisse, duration: 60, capacity: 15 },
      // Tuesday
      { day: 2, hour: 6, minute: 30, discipline: yoga, instructor: denisse, duration: 60, capacity: 15 },
      { day: 2, hour: 8, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 2, hour: 17, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 2, hour: 19, minute: 0, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      // Wednesday
      { day: 3, hour: 6, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 3, hour: 8, minute: 0, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 3, hour: 17, minute: 30, discipline: yoga, instructor: denisse, duration: 60, capacity: 15 },
      { day: 3, hour: 19, minute: 0, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      // Thursday
      { day: 4, hour: 6, minute: 30, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 4, hour: 8, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 4, hour: 17, minute: 30, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      { day: 4, hour: 19, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      // Friday
      { day: 5, hour: 6, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 5, hour: 8, minute: 0, discipline: yoga, instructor: denisse, duration: 60, capacity: 15 },
      { day: 5, hour: 17, minute: 30, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 5, hour: 19, minute: 0, discipline: terapiaDeSonido, instructor: nicole, duration: 75, capacity: 20 },
      // Saturday
      { day: 6, hour: 8, minute: 0, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 6, hour: 9, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 6, hour: 11, minute: 0, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      { day: 6, hour: 17, minute: 0, discipline: terapiaDeSonido, instructor: denisse, duration: 75, capacity: 20 },
    ]

    // Generate classes for the next 90 days (3 months)
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const currentDate = addDays(today, dayOffset)
      const dayOfWeek = currentDate.getDay()

      const dayClasses = weeklySchedule.filter((s) => s.day === dayOfWeek)

      for (const schedule of dayClasses) {
        // Create date in UTC that represents the correct El Salvador local time
        // e.g., 6:30 AM El Salvador = 12:30 UTC (6:30 + 6 hours offset)
        const classDateTime = new Date(Date.UTC(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          schedule.hour + EL_SALVADOR_UTC_OFFSET,
          schedule.minute
        ))

        classesToCreate.push({
          disciplineId: schedule.discipline.id,
          instructorId: schedule.instructor.id,
          dateTime: classDateTime,
          duration: schedule.duration,
          maxCapacity: schedule.capacity,
        })
      }
    }

    // Create all classes
    await prisma.class.createMany({
      data: classesToCreate,
    })

    return NextResponse.json({
      success: true,
      data: {
        disciplines: disciplines.length,
        instructors: instructors.length,
        packages: packages.length,
        classes: classesToCreate.length,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    )
  }
}
