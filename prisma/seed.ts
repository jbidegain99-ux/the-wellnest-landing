import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'

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
        name: 'Pole Fitness',
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
        name: 'Terapia de Sonido',
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
        name: 'Nutrición',
        slug: 'nutricion',
        description:
          'Consultas de nutrición personalizadas para mejorar tu alimentación y alcanzar tus objetivos de bienestar.',
        benefits:
          'Plan alimenticio personalizado, mejora tu relación con la comida, aumenta tu energía y vitalidad.',
        order: 5,
      },
    }),
    prisma.discipline.upsert({
      where: { slug: 'aro-telas' },
      update: {},
      create: {
        name: 'Aro y Telas',
        slug: 'aro-telas',
        description:
          'Aro y Telas (aéreos) es una mezcla perfecta de potencia y ligereza: desarrollas fuerza real, control y flexibilidad mientras aprendés a moverte en el aire con técnica y gracia. Te guiamos paso a paso en un ambiente seguro y motivador, para que disfrutes el proceso, construyas confianza y celebres cada logro—sin prisa, sin presión.',
        benefits:
          'Fuerza de agarre y antebrazos, estabilidad de hombros y espalda alta, técnica de subidas y control de descenso en telas, control de giros, balances y transiciones en aro, flexibilidad para líneas y aperturas en el aire.',
        order: 6,
      },
    }),
  ])

  console.log('Created disciplines:', disciplines.length)

  // =====================================================
  // INSTRUCTORES REALES - The Wellnest Team
  // =====================================================
  const instructors = await Promise.all([
    prisma.instructor.upsert({
      where: { id: 'instructor-nicolle' },
      update: {
        name: 'Nicolle Soundy',
        headline: 'Nutricionista · Especialidad en Nutrición Deportiva · Maestra de Yoga',
        bio: 'Acompaña tu bienestar desde el movimiento consciente y la práctica de yoga.',
        shortBio: 'Acompaña tu bienestar desde el movimiento consciente y la práctica de yoga. Su enfoque integra fuerza sutil, respiración y equilibrio para habitar tu cuerpo con presencia.',
        tags: ['Yoga', 'Nutrición', 'Nutrición Deportiva'],
        disciplines: ['Yoga', 'Nutrición'],
        isActive: true,
        order: 1,
      },
      create: {
        id: 'instructor-nicolle',
        name: 'Nicolle Soundy',
        headline: 'Nutricionista · Especialidad en Nutrición Deportiva · Maestra de Yoga',
        bio: 'Acompaña tu bienestar desde el movimiento consciente y la práctica de yoga.',
        shortBio: 'Acompaña tu bienestar desde el movimiento consciente y la práctica de yoga. Su enfoque integra fuerza sutil, respiración y equilibrio para habitar tu cuerpo con presencia.',
        tags: ['Yoga', 'Nutrición', 'Nutrición Deportiva'],
        disciplines: ['Yoga', 'Nutrición'],
        isActive: true,
        order: 1,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-florence' },
      update: {
        name: 'Florence Cervantes',
        headline: 'Nutricionista · Especialidad en Nutrición Deportiva · Instructora de Mat Pilates',
        bio: 'Guía sesiones de Pilates mat con técnica, delicadeza, precisión y cuidado.',
        shortBio: 'Guía sesiones de Pilates mat con técnica, delicadeza, precisión y cuidado. Fortalece tu cuerpo desde adentro, mejora tu postura y sostiene resultados con constancia.',
        tags: ['Mat Pilates', 'Nutrición', 'Nutrición Deportiva'],
        disciplines: ['Mat Pilates', 'Nutrición'],
        isActive: true,
        order: 2,
      },
      create: {
        id: 'instructor-florence',
        name: 'Florence Cervantes',
        headline: 'Nutricionista · Especialidad en Nutrición Deportiva · Instructora de Mat Pilates',
        bio: 'Guía sesiones de Pilates mat con técnica, delicadeza, precisión y cuidado.',
        shortBio: 'Guía sesiones de Pilates mat con técnica, delicadeza, precisión y cuidado. Fortalece tu cuerpo desde adentro, mejora tu postura y sostiene resultados con constancia.',
        tags: ['Mat Pilates', 'Nutrición', 'Nutrición Deportiva'],
        disciplines: ['Mat Pilates', 'Nutrición'],
        isActive: true,
        order: 2,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-adriana' },
      update: {
        name: 'Adriana Bidegain',
        headline: 'Facilitadora de Soundbath (terapia de sonido) · Instructora de Pilates Clásico · Nutricionista · Especialidad en Naturopatía',
        bio: 'Facilita la calma profunda con soundbath y meditaciones guiadas.',
        shortBio: 'Facilita la calma profunda con soundbath y meditaciones guiadas, apoyando la regulación del sistema nervioso. Te acompaña a volver a tu centro y nutrir tu ser con presencia, suavidad e intención.',
        tags: ['Soundbath', 'Pilates Clásico', 'Nutrición', 'Naturopatía'],
        disciplines: ['Terapia de Sonido', 'Pilates', 'Nutrición'],
        isActive: true,
        order: 3,
      },
      create: {
        id: 'instructor-adriana',
        name: 'Adriana Bidegain',
        headline: 'Facilitadora de Soundbath (terapia de sonido) · Instructora de Pilates Clásico · Nutricionista · Especialidad en Naturopatía',
        bio: 'Facilita la calma profunda con soundbath y meditaciones guiadas.',
        shortBio: 'Facilita la calma profunda con soundbath y meditaciones guiadas, apoyando la regulación del sistema nervioso. Te acompaña a volver a tu centro y nutrir tu ser con presencia, suavidad e intención.',
        tags: ['Soundbath', 'Pilates Clásico', 'Nutrición', 'Naturopatía'],
        disciplines: ['Terapia de Sonido', 'Pilates', 'Nutrición'],
        isActive: true,
        order: 3,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-kevin' },
      update: {
        name: 'Kevin Cano',
        headline: 'Lic. en Ciencias Aplicadas al Deporte y Educación Física · Maestro de Yoga · Instructor de Pole Fitness, Telas & Aéreo',
        bio: 'Energía, técnica y seguridad en cada clase.',
        shortBio: 'Energía, técnica y seguridad en cada clase. Te acompaña a ganar fuerza, control y confianza, con un enfoque deportivo que respeta tu proceso y celebra tus avances paso a paso.',
        tags: ['Yoga', 'Pole Fitness', 'Telas', 'Aéreo', 'Entrenamiento Funcional'],
        disciplines: ['Yoga', 'Pole Fitness', 'Aro y Telas'],
        isActive: true,
        order: 4,
      },
      create: {
        id: 'instructor-kevin',
        name: 'Kevin Cano',
        headline: 'Lic. en Ciencias Aplicadas al Deporte y Educación Física · Maestro de Yoga · Instructor de Pole Fitness, Telas & Aéreo',
        bio: 'Energía, técnica y seguridad en cada clase.',
        shortBio: 'Energía, técnica y seguridad en cada clase. Te acompaña a ganar fuerza, control y confianza, con un enfoque deportivo que respeta tu proceso y celebra tus avances paso a paso.',
        tags: ['Yoga', 'Pole Fitness', 'Telas', 'Aéreo', 'Entrenamiento Funcional'],
        disciplines: ['Yoga', 'Pole Fitness', 'Aro y Telas'],
        isActive: true,
        order: 4,
      },
    }),
    prisma.instructor.upsert({
      where: { id: 'instructor-denisse' },
      update: {
        name: 'Denisse Soundy',
        headline: 'HR Administrative · Instructora de Pole Fitness',
        bio: 'Aporta dinamismo y actitud en cada sesión.',
        shortBio: 'Aporta dinamismo y actitud en cada sesión, cuidando que el espacio sea cómodo, seguro y motivador. Acompaña el día a día del estudio desde la organización y la calidez humana.',
        tags: ['Pole Fitness', 'Comunidad'],
        disciplines: ['Pole Fitness'],
        isActive: true,
        order: 5,
      },
      create: {
        id: 'instructor-denisse',
        name: 'Denisse Soundy',
        headline: 'HR Administrative · Instructora de Pole Fitness',
        bio: 'Aporta dinamismo y actitud en cada sesión.',
        shortBio: 'Aporta dinamismo y actitud en cada sesión, cuidando que el espacio sea cómodo, seguro y motivador. Acompaña el día a día del estudio desde la organización y la calidez humana.',
        tags: ['Pole Fitness', 'Comunidad'],
        disciplines: ['Pole Fitness'],
        isActive: true,
        order: 5,
      },
    }),
  ])

  // Desactivar instructores de prueba si existen
  await prisma.instructor.updateMany({
    where: {
      OR: [
        { name: { contains: 'Prueba' } },
        { name: { contains: 'Test' } },
        { id: 'instructor-nicole' }, // Old ID
      ],
    },
    data: { isActive: false },
  })

  console.log('Created instructors:', instructors.length)

  // =====================================================
  // PAQUETES REALES - 7 paquetes con slugs estables
  // Helper para upsert por slug (slug no es unique)
  // =====================================================
  async function upsertPackageBySlug(data: {
    slug: string
    name: string
    subtitle: string
    shortDescription: string
    fullDescription: string
    classCount: number
    price: number
    currency: string
    validityDays: number
    validityText: string | null
    bulletsTop: string[]
    bulletsBottom: string[]
    originalPrice?: number | null
    discountPercent?: number | null
    isShareable?: boolean
    maxShares?: number
    isActive: boolean
    isFeatured: boolean
    order: number
  }) {
    const existing = await prisma.package.findFirst({ where: { slug: data.slug } })
    if (existing) {
      return prisma.package.update({ where: { id: existing.id }, data })
    }
    return prisma.package.create({ data })
  }

  const packages = await Promise.all([
    upsertPackageBySlug({
      slug: 'drop-in-class',
      name: 'Drop-In Class',
      subtitle: 'Ideal para fluir a tu propio ritmo',
      shortDescription: 'Ideal para fluir a tu propio ritmo',
      fullDescription: 'Perfecta para regalarte un momento consciente, probar una disciplina o adaptarte a semanas con horarios cambiantes.',
      classCount: 1,
      price: 15.00,
      currency: 'USD',
      validityDays: 5,
      validityText: null,
      bulletsTop: ['1 clase', '5 días de vigencia'],
      bulletsBottom: ['Válida para todas las disciplinas', 'Reserva desde la app', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 1,
    }),
    upsertPackageBySlug({
      slug: 'mini-flow-4',
      name: 'Mini Flow (4 clases)',
      subtitle: 'Una pausa semanal para reconectar',
      shortDescription: 'Una pausa semanal para reconectar',
      fullDescription: 'Un paquete suave y accesible para iniciar tu camino de bienestar, crear constancia y sentir el movimiento como medicina.',
      classCount: 4,
      price: 49.99,
      currency: 'USD',
      validityDays: 30,
      validityText: null,
      bulletsTop: ['4 clases', '30 días de vigencia'],
      bulletsBottom: ['Ideal para comenzar', 'Todas las disciplinas incluidas', 'Reserva fácil desde la app', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 2,
    }),
    upsertPackageBySlug({
      slug: 'balance-pass-8',
      name: 'Balance Pass (8 clases)',
      subtitle: 'Encuentra tu ritmo y sosténlo',
      shortDescription: 'Encuentra tu ritmo y sosténlo',
      fullDescription: 'Diseñado para quienes desean integrar el movimiento consciente como parte de su semana y equilibrar cuerpo y mente.',
      classCount: 8,
      price: 69.99,
      currency: 'USD',
      validityDays: 30,
      validityText: null,
      bulletsTop: ['8 clases', '30 días de vigencia'],
      bulletsBottom: ['Dos veces por semana', 'Acceso a todas las disciplinas', 'Flexibilidad total de horarios', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: true,
      order: 3,
    }),
    upsertPackageBySlug({
      slug: 'energia-total-12',
      name: 'Energía Total (12 clases)',
      subtitle: 'Movimiento constante, energía en expansión',
      shortDescription: 'Movimiento constante, energía en expansión',
      fullDescription: 'Un impulso energético para quienes buscan mayor presencia, fuerza y conexión interior a través del movimiento regular.',
      classCount: 12,
      price: 80.75,
      originalPrice: 95.00,
      discountPercent: 15,
      currency: 'USD',
      validityDays: 30,
      validityText: null,
      bulletsTop: ['12 clases', '30 días de vigencia', '15% de descuento'],
      bulletsBottom: ['Ideal para crear hábito', 'Todas las disciplinas incluidas', 'Reserva desde la app', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 4,
    }),
    upsertPackageBySlug({
      slug: 'vital-plan-16',
      name: 'Vital Plan (16 clases)',
      subtitle: 'Tu bienestar como prioridad',
      shortDescription: 'Tu bienestar como prioridad',
      fullDescription: 'Pensado para quienes eligen sostener su bienestar con intención, constancia y variedad de disciplinas.',
      classCount: 16,
      price: 115.00,
      currency: 'USD',
      validityDays: 30,
      validityText: null,
      bulletsTop: ['16 clases', '30 días de vigencia'],
      bulletsBottom: ['Hasta 4 clases por semana', 'Movimiento consciente y flexible', 'Acompaña tu ritmo de vida', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 5,
    }),
    upsertPackageBySlug({
      slug: 'full-access-24',
      name: 'Full Access (24 clases)',
      subtitle: 'Compromiso profundo con tu bienestar',
      shortDescription: 'Compromiso profundo con tu bienestar',
      fullDescription: 'Nuestro plan más completo para quienes desean integrar el movimiento como un estilo de vida consciente y presente en día a día.',
      classCount: 24,
      price: 116.00,
      originalPrice: 145.00,
      discountPercent: 20,
      currency: 'USD',
      validityDays: 35,
      validityText: null,
      bulletsTop: ['24 clases', '35 días de vigencia', '20% de descuento'],
      bulletsBottom: ['Máxima flexibilidad', 'Acceso total a disciplinas', 'Ideal para rutinas activas', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 6,
    }),
    upsertPackageBySlug({
      slug: 'wellnest-trimestral-80',
      name: 'Wellnest Trimestral (80 clases)',
      subtitle: 'Una experiencia integral de bienestar',
      shortDescription: 'Una experiencia integral de bienestar',
      fullDescription: 'Diseñado para quienes desean una transformación profunda, sostenida y consciente durante todo el trimestre.',
      classCount: 80,
      price: 355.00,
      isShareable: true,
      maxShares: 1,
      currency: 'USD',
      validityDays: 90,
      validityText: 'Vigencia trimestral',
      bulletsTop: ['80 clases', 'Vigencia trimestral', 'Puedes llevar un invitado a cada clase'],
      bulletsBottom: ['Acceso ilimitado a disciplinas', 'Compartible — invita a alguien diferente cada vez', 'Ideal para práctica constante', 'Cancela tu clase 8 horas antes'],
      isActive: true,
      isFeatured: false,
      order: 7,
    }),
    upsertPackageBySlug({
      slug: 'special-balance-5',
      name: 'Special Balance (5 clases)',
      subtitle: 'Movimiento + Nutrición',
      shortDescription: 'Un paquete especial diseñado para acompañarte de forma integral.',
      fullDescription: 'Un paquete especial diseñado para acompañarte de forma integral. Integra movimiento y nutrición para apoyar tu energía, tu equilibrio y tus objetivos de bienestar desde la raíz.',
      classCount: 5,
      price: 65.00,
      currency: 'USD',
      validityDays: 30,
      validityText: null,
      bulletsTop: ['5 clases de la disciplina que desees', '1 consulta nutricional personalizada', 'Vigencia: 30 días'],
      bulletsBottom: ['Acceso a todas las disciplinas', 'Consulta nutricional enfocada en hábitos reales y sostenibles', 'Ideal para iniciar o retomar tu proceso de bienestar'],
      isActive: true,
      isFeatured: true,
      order: 8,
    }),
  ])

  // Desactivar paquetes viejos/de prueba (los que no tienen nuestros slugs oficiales)
  const officialSlugs = [
    'drop-in-class', 'mini-flow-4', 'balance-pass-8',
    'energia-total-12', 'vital-plan-16', 'full-access-24', 'wellnest-trimestral-80',
    'special-balance-5'
  ]
  await prisma.package.updateMany({
    where: {
      OR: [
        { slug: null },
        { NOT: { slug: { in: officialSlugs } } },
      ],
    },
    data: { isActive: false },
  })

  console.log('Created packages:', packages.length)

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@thewellnest.sv' },
    update: {},
    create: {
      email: 'admin@thewellnest.sv',
      name: 'Admin Wellnest',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('Created admin user:', adminUser.email)

  // Create a test user with an active package
  const testUserPassword = await bcrypt.hash('test123', 12)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Usuario de Prueba',
      password: testUserPassword,
      role: 'USER',
    },
  })

  console.log('Created test user:', testUser.email)

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

  console.log('Created discount codes')

  // Get discipline and instructor IDs for classes
  const yoga = disciplines.find((d) => d.slug === 'yoga')!
  const pilates = disciplines.find((d) => d.slug === 'pilates')!
  const pole = disciplines.find((d) => d.slug === 'pole')!
  const soundbath = disciplines.find((d) => d.slug === 'soundbath')!

  const nicolle = instructors.find((i) => i.name === 'Nicolle Soundy')!
  const florence = instructors.find((i) => i.name === 'Florence Cervantes')!
  const adriana = instructors.find((i) => i.name === 'Adriana Bidegain')!
  const kevin = instructors.find((i) => i.name === 'Kevin Cano')!
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
    { day: 1, hour: 8, minute: 0, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 1, hour: 17, minute: 30, discipline: pole, instructor: kevin, duration: 60, capacity: 8 },
    { day: 1, hour: 19, minute: 0, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    // Tuesday
    { day: 2, hour: 6, minute: 30, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 2, hour: 8, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 2, hour: 17, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 2, hour: 19, minute: 0, discipline: pole, instructor: denisse, duration: 60, capacity: 8 },
    // Wednesday
    { day: 3, hour: 6, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 3, hour: 8, minute: 0, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 3, hour: 17, minute: 30, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 3, hour: 19, minute: 0, discipline: pole, instructor: kevin, duration: 60, capacity: 8 },
    // Thursday
    { day: 4, hour: 6, minute: 30, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 4, hour: 8, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 4, hour: 17, minute: 30, discipline: pole, instructor: denisse, duration: 60, capacity: 8 },
    { day: 4, hour: 19, minute: 0, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    // Friday
    { day: 5, hour: 6, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 5, hour: 8, minute: 0, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 5, hour: 17, minute: 30, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 5, hour: 19, minute: 0, discipline: soundbath, instructor: adriana, duration: 75, capacity: 20 },
    // Saturday
    { day: 6, hour: 8, minute: 0, discipline: yoga, instructor: nicolle, duration: 60, capacity: 15 },
    { day: 6, hour: 9, minute: 30, discipline: pilates, instructor: florence, duration: 50, capacity: 12 },
    { day: 6, hour: 11, minute: 0, discipline: pole, instructor: kevin, duration: 60, capacity: 8 },
    { day: 6, hour: 17, minute: 0, discipline: soundbath, instructor: adriana, duration: 75, capacity: 20 },
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

  console.log('Created classes:', classesToCreate.length)

  // Create a test purchase for the test user (Balance Pass 8 clases)
  const balancePassPackage = packages.find((p) => p.slug === 'balance-pass-8')!
  await prisma.purchase.upsert({
    where: { id: 'test-purchase-1' },
    update: {},
    create: {
      id: 'test-purchase-1',
      userId: testUser.id,
      packageId: balancePassPackage.id,
      classesRemaining: 6,
      expiresAt: addDays(new Date(), 45),
      originalPrice: 69.99,
      finalPrice: 69.99,
      status: 'ACTIVE',
    },
  })

  console.log('Created test purchase for test user')

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
