/**
 * READ-ONLY audit. Lista todas las PrivateSessionRequest en estado PENDING
 * con preferredSlot1/2/3 no nulos (las que vamos a partir 1→3 paquetes).
 *
 * Para cada solicitud imprime:
 *   - usuaria (email, name)
 *   - purchase (id, classesRemaining, expiresAt)
 *   - disciplina preferida + instructores activos en esa disciplina
 *   - instructor preferido (si lo eligio)
 *   - los 3 slots formateados en zona America/El_Salvador
 *
 * Tambien escribe un template JSON a:
 *   scripts/_data/private-flow-backfill-input.json
 *
 * Para que rellenes manualmente el instructorId por slot antes de correr
 * scripts/backfill-private-flow-split.ts.
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface BackfillTemplateEntry {
  userEmail: string
  disciplineName: string
  preferredInstructorName: string | null
  slot1: { dateTime: string; instructorId: string }
  slot2: { dateTime: string; instructorId: string }
  slot3: { dateTime: string; instructorId: string }
}

type BackfillTemplate = Record<string, BackfillTemplateEntry>

function formatSV(iso: Date): string {
  return new Intl.DateTimeFormat('es-SV', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/El_Salvador',
  }).format(iso)
}

async function main() {
  console.log('\n=== AUDIT: PrivateSessionRequest PENDING con 3 slots ===\n')

  const pendingRequests = await prisma.privateSessionRequest.findMany({
    where: {
      status: 'PENDING',
      preferredSlot2: { not: null },
      preferredSlot3: { not: null },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      purchase: {
        include: { package: { select: { id: true, slug: true, name: true, isPrivate: true } } },
      },
      preferredDiscipline: { select: { id: true, name: true, slug: true } },
      preferredInstructor: { select: { id: true, name: true } },
      confirmedClasses: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total solicitudes PENDING con 3 slots: ${pendingRequests.length}\n`)

  if (pendingRequests.length === 0) {
    console.log('Nada que hacer. ✓')
    return
  }

  // Lista de instructores activos por disciplina (para que el admin sepa qué opciones tiene).
  // Instructor.disciplines es String[] de NOMBRES (ej. ["Yoga", "Pilates"]).
  const disciplineNamesById = new Map(
    pendingRequests.map((r) => [r.preferredDisciplineId, r.preferredDiscipline.name])
  )
  const instructorsByDiscipline = new Map<string, { id: string; name: string }[]>()
  for (const [did, dname] of disciplineNamesById) {
    const list = await prisma.instructor.findMany({
      where: {
        isActive: true,
        disciplines: { has: dname },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    instructorsByDiscipline.set(did, list)
  }

  const template: BackfillTemplate = {}
  const skipped: string[] = []

  for (const r of pendingRequests) {
    console.log('────────────────────────────────────────────────────────')
    console.log(`Request:    ${r.id}`)
    console.log(`Usuaria:    ${r.user.name ?? '(sin nombre)'}  <${r.user.email}>`)
    console.log(`Purchase:   ${r.purchase.id}`)
    console.log(`            classesRemaining=${r.purchase.classesRemaining}, status=${r.purchase.status}, expiresAt=${r.purchase.expiresAt.toISOString().slice(0, 10)}`)
    console.log(`            package='${r.purchase.package.name}' (isPrivate=${r.purchase.package.isPrivate})`)
    console.log(`Disciplina: ${r.preferredDiscipline.name}`)
    console.log(`Pref inst:  ${r.preferredInstructor?.name ?? '(no eligió)'}`)
    console.log(`Notas:      ${r.notes ?? '—'}`)
    console.log(`Slot 1:     ${formatSV(r.preferredSlot1)}`)
    console.log(`Slot 2:     ${r.preferredSlot2 ? formatSV(r.preferredSlot2) : '—'}`)
    console.log(`Slot 3:     ${r.preferredSlot3 ? formatSV(r.preferredSlot3) : '—'}`)

    const instructors = instructorsByDiscipline.get(r.preferredDisciplineId) ?? []
    console.log(`Instructores activos en '${r.preferredDiscipline.name}':`)
    if (instructors.length === 0) {
      console.log('  (ninguno activo — revisar manualmente)')
    } else {
      for (const i of instructors) {
        const star = i.id === r.preferredInstructorId ? ' ★ preferido' : ''
        console.log(`  - ${i.id}  ${i.name}${star}`)
      }
    }

    // Sanity checks
    const reasons: string[] = []
    if (!r.purchase.package.isPrivate) reasons.push('paquete no es isPrivate')
    if (r.purchase.status !== 'ACTIVE') reasons.push(`purchase status=${r.purchase.status}`)
    if (r.purchase.classesRemaining < 1) reasons.push('purchase sin créditos')
    if (r.purchase.expiresAt <= new Date()) reasons.push('purchase vencido')
    if (r.confirmedClasses.length > 0) reasons.push(`ya tiene ${r.confirmedClasses.length} clases vinculadas`)
    if (reasons.length > 0) {
      console.log(`⚠️  ESTA SOLICITUD SE OMITIRÍA EN BACKFILL: ${reasons.join('; ')}`)
      skipped.push(`${r.id} (${r.user.email}): ${reasons.join('; ')}`)
      continue
    }

    // Default = preferido si existe; sino el primero de la lista (placeholder a editar)
    const defaultInstructorId =
      r.preferredInstructorId ?? instructors[0]?.id ?? 'FILL_IN_INSTRUCTOR_ID'

    template[r.id] = {
      userEmail: r.user.email,
      disciplineName: r.preferredDiscipline.name,
      preferredInstructorName: r.preferredInstructor?.name ?? null,
      slot1: {
        dateTime: r.preferredSlot1.toISOString(),
        instructorId: defaultInstructorId,
      },
      slot2: {
        dateTime: r.preferredSlot2!.toISOString(),
        instructorId: defaultInstructorId,
      },
      slot3: {
        dateTime: r.preferredSlot3!.toISOString(),
        instructorId: defaultInstructorId,
      },
    }
  }

  // Tambien: PSR PENDING con slot2/3 null (legacy 1-slot) — solo informativo
  const legacyPending = await prisma.privateSessionRequest.count({
    where: {
      status: 'PENDING',
      OR: [{ preferredSlot2: null }, { preferredSlot3: null }],
    },
  })
  if (legacyPending > 0) {
    console.log('────────────────────────────────────────────────────────')
    console.log(`\nInfo: hay ${legacyPending} PSR PENDING con slot2 o slot3 null (legacy 1-slot).`)
    console.log(`Estas NO se procesan en este backfill — el admin las puede confirmar normal con el flujo de 1 sesión.`)
  }

  // Tambien: CONFIRMED con 3 reservas (ya creadas por la rama nueva)
  const confirmedWith3Reservations = await prisma.privateSessionRequest.findMany({
    where: {
      status: 'CONFIRMED',
      preferredSlot2: { not: null },
      preferredSlot3: { not: null },
    },
    include: { confirmedClasses: { select: { id: true } } },
  })
  const confirmedMulti = confirmedWith3Reservations.filter((r) => r.confirmedClasses.length > 1)
  if (confirmedMulti.length > 0) {
    console.log('────────────────────────────────────────────────────────')
    console.log(`\n⚠️  Hay ${confirmedMulti.length} PSR CONFIRMED con >1 clase vinculada (rama nueva ya ejecutada):`)
    for (const r of confirmedMulti) {
      console.log(`  - ${r.id}  (${r.confirmedClasses.length} clases)`)
    }
    console.log(`Estas tienen las 3 reservas pero comparten 1 Purchase. Si querés partir el Purchase también para estas, avisame.`)
  }

  // Escribir template
  const outDir = path.join(process.cwd(), 'scripts', '_data')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'private-flow-backfill-input.json')
  fs.writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8')

  console.log('\n────────────────────────────────────────────────────────')
  console.log(`\nResumen:`)
  console.log(`  - Solicitudes a procesar: ${Object.keys(template).length}`)
  console.log(`  - Omitidas: ${skipped.length}`)
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`      ${s}`)
  }
  console.log(`\nTemplate JSON escrito a: ${path.relative(process.cwd(), outPath)}`)
  console.log(`\n⚠️  Revisa el JSON y reemplaza cada instructorId si es necesario antes de correr el backfill.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
