import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

function mapDisciplineSlugs(name: string): { primary: string; complementary: string | null } {
  const n = name.trim().toLowerCase()
  if (n.includes('yoga') && n.includes('soundbath')) return { primary: 'yoga', complementary: 'soundbath' }
  if (n.includes('yoga')) return { primary: 'yoga', complementary: null }
  if (n.includes('pole')) return { primary: 'pole', complementary: null }
  if (n.includes('pilates')) return { primary: 'pilates', complementary: null }
  if (n.includes('soundbath') || n.includes('meditacion')) return { primary: 'soundbath', complementary: null }
  if (n.includes('tela') || n.includes('aro')) return { primary: 'aro-telas', complementary: null }
  return { primary: 'yoga', complementary: null }
}

function mapInstructorId(name: string): string {
  const n = name.trim().toLowerCase()
  if (n.includes('nicolle') && n.includes('adri')) return 'instructor-nicolle'
  if (n.includes('kevin')) return 'instructor-kevin'
  if (n.includes('adri')) return 'instructor-adriana'
  if (n.includes('nicolle')) return 'instructor-nicolle'
  if (n.includes('dani')) return 'instructor-dani'
  if (n.includes('jaime')) return 'instructor-jaime'
  if (n.includes('denisse')) return 'instructor-denisse'
  if (n.includes('vicky')) return 'instructor-vicky'
  if (n.includes('jessica')) return 'instructor-jessica'
  if (n.includes('florence')) return 'instructor-florence'
  return 'instructor-adriana'
}

interface ClassEntry {
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
    { id: 'instructor-vicky', name: 'Vicky', disciplines: ['Pole Fitness'] },
    { id: 'instructor-jessica', name: 'Jessica', disciplines: ['Pole Fitness'] },
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
  }
  console.log('  Instructors ready')
}

async function main() {
  console.log('=== Cargando Clases Horario Fijo Semana 16-21 Marzo 2026 ===\n')

  console.log('1. Asegurando instructores...')
  await ensureInstructors()

  const disciplines = await prisma.discipline.findMany()
  const discMap = new Map(disciplines.map(d => [d.slug, d.id]))

  // Classes from "Horario Fijo semana 16 - 21" sheet (same structure as 9-14 but different dates)
  const classes: ClassEntry[] = [
    // Lunes 16 marzo (7 classes)
    { date: '2026-03-16', dayOfWeek: 1, startTime: '05:15', endTime: '06:00', discipline: 'Sculpt Pilates', instructor: 'Dani', capacity: 12 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '06:15', endTime: '07:00', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '07:15', endTime: '08:00', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '17:15', endTime: '18:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '18:15', endTime: '19:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '19:15', endTime: '20:00', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-16', dayOfWeek: 1, startTime: '20:15', endTime: '21:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    // Martes 17 marzo (4 classes)
    { date: '2026-03-17', dayOfWeek: 2, startTime: '17:15', endTime: '18:00', discipline: 'Sculpt Pilates', instructor: 'Dani', capacity: 12 },
    { date: '2026-03-17', dayOfWeek: 2, startTime: '18:15', endTime: '19:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-17', dayOfWeek: 2, startTime: '19:15', endTime: '20:00', discipline: 'Telas', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-17', dayOfWeek: 2, startTime: '20:15', endTime: '21:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    // Miércoles 18 marzo (9 classes)
    { date: '2026-03-18', dayOfWeek: 3, startTime: '06:15', endTime: '07:00', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '07:15', endTime: '08:00', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '08:30', endTime: '09:15', discipline: 'Sculpt Pilates', instructor: 'Dani', capacity: 12 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '09:15', endTime: '10:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '15:15', endTime: '16:00', discipline: 'Pole Dance', instructor: 'Vicky', capacity: 6 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '17:15', endTime: '18:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '18:00', endTime: '18:45', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '19:15', endTime: '20:00', discipline: 'Pole Flow', instructor: 'Jessica', capacity: 6 },
    { date: '2026-03-18', dayOfWeek: 3, startTime: '20:00', endTime: '20:45', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    // Jueves 19 marzo (4 classes)
    { date: '2026-03-19', dayOfWeek: 4, startTime: '17:00', endTime: '17:45', discipline: 'Pole Dance', instructor: 'Denisse', capacity: 6 },
    { date: '2026-03-19', dayOfWeek: 4, startTime: '18:15', endTime: '19:00', discipline: 'Pilates Clasico Strech & Flow', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-19', dayOfWeek: 4, startTime: '19:15', endTime: '19:55', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-19', dayOfWeek: 4, startTime: '20:00', endTime: '20:45', discipline: 'Aro', instructor: 'Kevin', capacity: 6 },
    // Viernes 20 marzo (7 classes)
    { date: '2026-03-20', dayOfWeek: 5, startTime: '06:15', endTime: '07:00', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '08:00', endTime: '08:45', discipline: 'Pilates', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '09:15', endTime: '10:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '17:00', endTime: '17:45', discipline: 'Pole Dance', instructor: 'Denisse', capacity: 12 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '18:00', endTime: '18:45', discipline: 'Pilates Clasico Strech & Flow', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '19:15', endTime: '20:00', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-20', dayOfWeek: 5, startTime: '20:00', endTime: '20:45', discipline: 'Telas', instructor: 'Jaime', capacity: 6 },
    // Sábado 21 marzo (6 classes)
    { date: '2026-03-21', dayOfWeek: 6, startTime: '06:15', endTime: '07:00', discipline: 'Yoga', instructor: 'Nicolle', capacity: 12 },
    { date: '2026-03-21', dayOfWeek: 6, startTime: '08:15', endTime: '09:00', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
    { date: '2026-03-21', dayOfWeek: 6, startTime: '09:15', endTime: '10:00', discipline: 'Aro', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-21', dayOfWeek: 6, startTime: '10:15', endTime: '11:00', discipline: 'Pole Dance', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-21', dayOfWeek: 6, startTime: '15:15', endTime: '16:00', discipline: 'Aro', instructor: 'Kevin', capacity: 6 },
    { date: '2026-03-21', dayOfWeek: 6, startTime: '16:15', endTime: '17:00', discipline: 'Soundbath & Meditacion Guiada', instructor: 'Adri', capacity: 12 },
  ]

  console.log(`\n2. Total classes to insert: ${classes.length}`)

  const dayCounts = new Map<string, number>()
  for (const c of classes) {
    dayCounts.set(c.date, (dayCounts.get(c.date) || 0) + 1)
  }
  console.log('  Per day:', Object.fromEntries(dayCounts))

  console.log('\n3. Insertando clases...\n')

  let count = 0
  for (const c of classes) {
    const { primary, complementary } = mapDisciplineSlugs(c.discipline)
    const disciplineId = discMap.get(primary)
    if (!disciplineId) {
      console.error(`  SKIP: No discipline for "${c.discipline}" (slug: ${primary})`)
      continue
    }

    const complementaryDisciplineId = complementary ? discMap.get(complementary) || null : null

    const instructorId = mapInstructorId(c.instructor)
    const duration = durationMinutes(c.startTime, c.endTime)
    const [y, mo, d] = c.date.split('-').map(Number)
    const [hh, mm] = c.startTime.split(':').map(Number)
    // El Salvador is UTC-6: add 6 hours to store correct UTC time
    const dateTime = new Date(Date.UTC(y, mo - 1, d, hh + 6, mm, 0))

    await prisma.class.create({
      data: {
        disciplineId,
        complementaryDisciplineId,
        instructorId,
        dateTime,
        duration,
        maxCapacity: c.capacity,
        classType: 'regular',
        notes: `${c.discipline} - ${c.instructor} (Semana 16-21 Mar)`,
      },
    })
    count++
    console.log(`  ✓ ${c.date} ${c.startTime}-${c.endTime} | ${c.discipline} | ${c.instructor} | ${c.capacity}`)
  }

  console.log(`\n=== ${count} clases cargadas (semana 16-21) ===`)
  const total = await prisma.class.count()
  console.log(`Total de clases en BD: ${total}\n`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
