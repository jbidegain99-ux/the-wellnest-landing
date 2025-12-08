import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'

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
        update: {},
        create: {
          name: 'Pole',
          slug: 'pole',
          description:
            'Pole combina danza, acrobacia y fitness en una disciplina que desarrolla fuerza, flexibilidad y confianza.',
          benefits:
            'Desarrolla fuerza funcional completa, mejora la coordinación y equilibrio, aumenta la confianza y autoestima.',
          order: 3,
        },
      }),
      prisma.discipline.upsert({
        where: { slug: 'soundbath' },
        update: {},
        create: {
          name: 'Sound Bath',
          slug: 'soundbath',
          description:
            'Sound Bath es una experiencia meditativa donde te sumerges en frecuencias sanadoras producidas por cuencos tibetanos y otros instrumentos.',
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
          bio: 'Co-fundadora de wellnest. Certificada en Yoga y Sound Healing. Con más de 8 años de experiencia guiando prácticas de bienestar integral.',
          disciplines: ['Yoga', 'Sound Bath'],
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
        where: { id: 'package-4' },
        update: {},
        create: {
          id: 'package-4',
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
        where: { id: 'package-8' },
        update: {},
        create: {
          id: 'package-8',
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
        where: { id: 'package-12' },
        update: {},
        create: {
          id: 'package-12',
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
        where: { id: 'package-unlimited' },
        update: {},
        create: {
          id: 'package-unlimited',
          name: 'Mensual Ilimitado',
          shortDescription: 'Sin límites',
          fullDescription:
            'Clases ilimitadas durante un mes completo. La libertad total para practicar cuando quieras.',
          classCount: 999,
          price: 150,
          validityDays: 30,
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
    const soundbath = disciplines.find((d) => d.slug === 'soundbath')!

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
      { day: 5, hour: 19, minute: 0, discipline: soundbath, instructor: nicole, duration: 75, capacity: 20 },
      // Saturday
      { day: 6, hour: 8, minute: 0, discipline: yoga, instructor: nicole, duration: 60, capacity: 15 },
      { day: 6, hour: 9, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
      { day: 6, hour: 11, minute: 0, discipline: pole, instructor: adriana, duration: 60, capacity: 8 },
      { day: 6, hour: 17, minute: 0, discipline: soundbath, instructor: denisse, duration: 75, capacity: 20 },
    ]

    // Generate classes for the next 90 days (3 months)
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const currentDate = addDays(today, dayOffset)
      const dayOfWeek = currentDate.getDay()

      const dayClasses = weeklySchedule.filter((s) => s.day === dayOfWeek)

      for (const schedule of dayClasses) {
        const classDateTime = setMinutes(setHours(currentDate, schedule.hour), schedule.minute)

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
