import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Excel time fraction → "HH:MM"
function excelTimeToString(val: string | number): string {
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return String(val).trim()
}

// Duration in minutes between two time strings
function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

interface ClassData {
  date: string
  dayOfWeek: number
  startTime: string
  endTime: string
  discipline: string
  instructor: string
  capacity: number
}

async function ensureInstructors() {
  const needed = [
    { id: 'instructor-dani', name: 'Dani', disciplines: ['Pilates'] },
    { id: 'instructor-jaime', name: 'Jaime', disciplines: ['Aro y Telas'] },
  ]
  for (const inst of needed) {
    await prisma.instructor.upsert({
      where: { id: inst.id },
      update: {},
      create: {
        id: inst.id,
        name: inst.name,
        bio: '',
        disciplines: inst.disciplines,
        isActive: true,
      },
    })
    console.log(`  Instructor "${inst.name}" ready`)
  }
}

async function ensureAroTelasDiscipline() {
  const existing = await prisma.discipline.findUnique({ where: { slug: 'aro-telas' } })
  if (existing && existing.id === '') {
    // Fix the empty ID - delete and recreate
    await prisma.$executeRaw`DELETE FROM "Discipline" WHERE slug = 'aro-telas'`
    await prisma.discipline.create({
      data: {
        name: 'Aro y Telas',
        slug: 'aro-telas',
        description: 'Disciplina de aro y telas aéreas',
        benefits: 'Fuerza, flexibilidad, expresión artística',
        isActive: true,
      },
    })
    console.log('  Fixed "Aro y Telas" discipline (was empty ID)')
  } else if (!existing) {
    await prisma.discipline.create({
      data: {
        name: 'Aro y Telas',
        slug: 'aro-telas',
        description: 'Disciplina de aro y telas aéreas',
        benefits: 'Fuerza, flexibilidad, expresión artística',
        isActive: true,
      },
    })
    console.log('  Created "Aro y Telas" discipline')
  }
}

// Map discipline name from Excel → discipline slug
function mapDisciplineSlug(name: string): string {
  const n = name.trim().toLowerCase()
  if (n.includes('yoga') && n.includes('soundbath')) return 'yoga' // Yoga + Soundbath → Yoga
  if (n.includes('yoga')) return 'yoga'
  if (n.includes('pole')) return 'pole'
  if (n.includes('pilates')) return 'pilates'
  if (n.includes('soundbath') || n.includes('meditacion')) return 'soundbath'
  if (n.includes('tela') || n.includes('aro')) return 'aro-telas'
  return 'yoga' // fallback
}

// Map instructor name from Excel → instructor ID
function mapInstructorId(name: string): string {
  const n = name.trim().toLowerCase()
  if (n.includes('nicolle') && n.includes('adri')) return 'instructor-nicolle'
  if (n.includes('kevin')) return 'instructor-kevin'
  if (n.includes('adri')) return 'instructor-adriana'
  if (n.includes('nicolle')) return 'instructor-nicolle'
  if (n.includes('dani')) return 'instructor-dani'
  if (n.includes('jaime')) return 'instructor-jaime'
  if (n.includes('denisse')) return 'instructor-denisse'
  if (n.includes('florence')) return 'instructor-florence'
  return 'instructor-adriana' // fallback
}

async function main() {
  console.log('=== Cargando 12 Clases de Prueba (4-7 Marzo 2026) ===\n')

  console.log('1. Asegurando datos base...')
  await ensureAroTelasDiscipline()
  await ensureInstructors()

  // Build discipline slug → ID map
  const disciplines = await prisma.discipline.findMany()
  const discMap = new Map(disciplines.map(d => [d.slug, d.id]))

  // 12 test classes from "Clases de Prueba" sheet
  const classes: ClassData[] = [
    // Miércoles 4 Marzo
    { date: '2026-03-04', dayOfWeek: 3, startTime: '17:00', endTime: '17:45', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-04', dayOfWeek: 3, startTime: '18:00', endTime: '18:45', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-04', dayOfWeek: 3, startTime: '19:00', endTime: '19:45', discipline: 'Yoga + Soundbath', instructor: 'Nicolle y Adri', capacity: 12 },
    // Jueves 5 Marzo
    { date: '2026-03-05', dayOfWeek: 4, startTime: '09:00', endTime: '09:45', discipline: 'Pilates Clasico Strech & Flow', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-05', dayOfWeek: 4, startTime: '15:00', endTime: '15:45', discipline: 'Sculpt Pilates', instructor: 'Dani', capacity: 12 },
    { date: '2026-03-05', dayOfWeek: 4, startTime: '17:00', endTime: '17:45', discipline: 'Yoga + Soundbath', instructor: 'Nicolle y Adri', capacity: 12 },
    // Viernes 6 Marzo
    { date: '2026-03-06', dayOfWeek: 5, startTime: '17:00', endTime: '17:45', discipline: 'Pilates', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-06', dayOfWeek: 5, startTime: '19:00', endTime: '19:45', discipline: 'Telas/Aro', instructor: 'Jaime', capacity: 6 },
    { date: '2026-03-06', dayOfWeek: 5, startTime: '08:00', endTime: '08:45', discipline: 'Pilates Clasico Strech & Flow', instructor: 'Adri', capacity: 12 },
    // Sábado 7 Marzo
    { date: '2026-03-07', dayOfWeek: 6, startTime: '09:00', endTime: '09:45', discipline: 'Pole', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-07', dayOfWeek: 6, startTime: '10:00', endTime: '10:45', discipline: 'Pole', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-07', dayOfWeek: 6, startTime: '11:00', endTime: '11:30', discipline: 'Soundbath', instructor: 'Adri', capacity: 12 },
  ]

  console.log(`\n2. Insertando ${classes.length} clases de prueba...\n`)

  let count = 0
  for (const c of classes) {
    const discSlug = mapDisciplineSlug(c.discipline)
    const disciplineId = discMap.get(discSlug)
    if (!disciplineId) {
      console.error(`  SKIP: No discipline found for "${c.discipline}" (slug: ${discSlug})`)
      continue
    }

    const instructorId = mapInstructorId(c.instructor)
    const duration = durationMinutes(c.startTime, c.endTime)
    const [y, m, d] = c.date.split('-').map(Number)
    const [hh, mm] = c.startTime.split(':').map(Number)
    const dateTime = new Date(Date.UTC(y, m - 1, d, hh, mm, 0))

    await prisma.class.create({
      data: {
        disciplineId,
        instructorId,
        dateTime,
        duration,
        maxCapacity: c.capacity,
        classType: 'test',
        notes: `${c.discipline} - ${c.instructor} (Clase de prueba)`,
      },
    })
    count++
    console.log(`  ✓ ${c.date} ${c.startTime}-${c.endTime} | ${c.discipline} | ${c.instructor} | ${c.capacity} cupos`)
  }

  console.log(`\n=== ${count} clases de prueba cargadas ===`)
  const total = await prisma.class.count()
  console.log(`Total de clases en BD: ${total}\n`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
