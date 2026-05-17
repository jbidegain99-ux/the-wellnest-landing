/**
 * Backfill one-shot: parte PrivateSessionRequest PENDING con 3 slots en
 * 3 reservas + 3 paquetes (slot1 usa la compra original, slot2 y slot3
 * usan paquetes spawneados con finalPrice=0 y ExcludedPurchase).
 *
 * Lee el JSON producido por scripts/audit-pending-3slot-requests.ts:
 *   scripts/_data/private-flow-backfill-input.json
 *
 * Uso:
 *   npx tsx scripts/backfill-private-flow-split.ts --dry-run
 *   npx tsx scripts/backfill-private-flow-split.ts                       # exige confirmar conflictos
 *   npx tsx scripts/backfill-private-flow-split.ts --allow-duplicates    # ignora warnings y aplica
 *
 * Idempotente: si la PSR ya no es PENDING o ya tiene clases vinculadas, salta.
 */
import { PrismaClient } from '@prisma/client'
import {
  sendEmail,
  buildPrivateSessionConfirmationEmail,
} from '../src/lib/emailService'
import { formatDateTimeFull } from '../src/lib/utils'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')
const ALLOW_DUPLICATES = process.argv.includes('--allow-duplicates')
const SKIP_EMAILS = process.argv.includes('--skip-emails')

// Admin que va a quedar como confirmedBy. Default: Adriana (dueña).
const ADMIN_USER_ID =
  process.env.BACKFILL_ADMIN_USER_ID || 'cmm7vd3qr0000frmvfqblzq81' // Adriana Bidegain

const INPUT_PATH = path.join(
  process.cwd(),
  'scripts',
  '_data',
  'private-flow-backfill-input.json'
)

interface SlotInput {
  dateTime: string // ISO
  instructorId: string
}
interface RequestInput {
  userEmail: string
  disciplineName: string
  preferredInstructorName: string | null
  slot1: SlotInput
  slot2: SlotInput
  slot3: SlotInput
}
type InputMap = Record<string, RequestInput>

async function main() {
  if (DRY_RUN) console.log('\n[DRY RUN] No se escribirán cambios.\n')
  else console.log('\n[LIVE] Aplicando cambios.\n')

  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`No existe ${INPUT_PATH}. Corre primero el audit.`)
  }
  const input: InputMap = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'))
  const requestIds = Object.keys(input)
  console.log(`Solicitudes en el JSON: ${requestIds.length}\n`)

  if (requestIds.length === 0) {
    console.log('Nada que procesar.')
    return
  }

  // Verificar admin
  const admin = await prisma.user.findUnique({
    where: { id: ADMIN_USER_ID },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!admin || admin.role !== 'ADMIN') {
    throw new Error(
      `ADMIN_USER_ID=${ADMIN_USER_ID} no existe o no es ADMIN. Usa BACKFILL_ADMIN_USER_ID env var.`
    )
  }
  console.log(`Admin confirmando: ${admin.name} <${admin.email}>\n`)

  // === Detección de conflictos antes de aplicar ===
  const warnings: string[] = []
  const errors: string[] = []

  // Cargar todas las requests + clases existentes del mismo instructor a la vez
  const allInstructorIds = Array.from(
    new Set(
      Object.values(input).flatMap((r) => [
        r.slot1.instructorId,
        r.slot2.instructorId,
        r.slot3.instructorId,
      ])
    )
  )
  const existingClasses = await prisma.class.findMany({
    where: {
      instructorId: { in: allInstructorIds },
      isCancelled: false,
    },
    select: { id: true, instructorId: true, dateTime: true },
  })
  const existingByInstructor = new Map<string, Date[]>()
  for (const c of existingClasses) {
    const arr = existingByInstructor.get(c.instructorId) ?? []
    arr.push(c.dateTime)
    existingByInstructor.set(c.instructorId, arr)
  }

  // Detección de conflictos dentro de un request (Keni: slot1 == slot3)
  for (const [reqId, r] of Object.entries(input)) {
    const slots = [r.slot1, r.slot2, r.slot3]
    const dates = slots.map((s) => new Date(s.dateTime).toISOString())
    if (new Set(dates).size !== 3) {
      const dup = dates.filter((d, i) => dates.indexOf(d) !== i)[0]
      errors.push(
        `${reqId} (${r.userEmail}): slots duplicados (${dup}). Una usuaria no puede tener 2 reservas al mismo instante.`
      )
    }
  }

  // Detección de conflictos contra clases ya existentes (mismo instructor + mismo dateTime)
  for (const [reqId, r] of Object.entries(input)) {
    const slots = [
      { label: 'slot1', s: r.slot1 },
      { label: 'slot2', s: r.slot2 },
      { label: 'slot3', s: r.slot3 },
    ]
    for (const { label, s } of slots) {
      const existing = existingByInstructor.get(s.instructorId) ?? []
      if (existing.some((d) => d.getTime() === new Date(s.dateTime).getTime())) {
        warnings.push(
          `${reqId} (${r.userEmail}) ${label}: ya hay una clase del mismo instructor en ${s.dateTime}.`
        )
      }
    }
  }

  // Detección de conflictos entre requests (mismo instructor + mismo dateTime entre 2+ usuarias)
  const slotMap = new Map<string, string[]>() // key = instructorId|isoDate -> [reqId/label/userEmail]
  for (const [reqId, r] of Object.entries(input)) {
    for (const [label, s] of [
      ['slot1', r.slot1],
      ['slot2', r.slot2],
      ['slot3', r.slot3],
    ] as const) {
      const key = `${s.instructorId}|${new Date(s.dateTime).toISOString()}`
      const arr = slotMap.get(key) ?? []
      arr.push(`${reqId} ${label} (${r.userEmail})`)
      slotMap.set(key, arr)
    }
  }
  for (const [key, refs] of slotMap) {
    if (refs.length > 1) {
      warnings.push(`Colisión [${key}]:\n    ${refs.join('\n    ')}`)
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (mismo instructor+horario entre solicitudes o vs clases existentes):')
    for (const w of warnings) console.log(`  • ${w}`)
  }
  if (errors.length > 0) {
    console.log('\n❌ ERRORES (slots duplicados dentro de la misma solicitud):')
    for (const e of errors) console.log(`  • ${e}`)
    if (!ALLOW_DUPLICATES) {
      console.log(
        '\nAborto por errores. Corregí el JSON o usá --allow-duplicates para forzar.'
      )
      return
    } else {
      console.log('\n⚠️  --allow-duplicates activo: voy a crear reservas duplicadas igual.')
    }
  }
  if (warnings.length > 0 && !DRY_RUN && !ALLOW_DUPLICATES) {
    console.log(
      '\nHay warnings. Revisalos y corré con --allow-duplicates para aplicar.'
    )
    return
  }

  // === Aplicar ===
  let appliedCount = 0
  let skippedCount = 0
  for (const reqId of requestIds) {
    const inputData = input[reqId]
    try {
      const result = await processRequest(reqId, inputData)
      if (result === 'skipped') skippedCount++
      else appliedCount++
    } catch (e) {
      console.log(`  ❌ ERROR procesando ${reqId}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log('\n════════════════════════════════════════')
  console.log(`Aplicadas: ${appliedCount}`)
  console.log(`Omitidas:  ${skippedCount}`)
  if (DRY_RUN) console.log('\n[DRY RUN] No se escribió nada.')
}

async function processRequest(
  requestId: string,
  data: RequestInput
): Promise<'applied' | 'skipped'> {
  console.log(`\n→ ${requestId} (${data.userEmail})`)

  // Estado fresh
  const psr = await prisma.privateSessionRequest.findUnique({
    where: { id: requestId },
    include: {
      purchase: { include: { package: true } },
      confirmedClasses: { select: { id: true } },
    },
  })
  if (!psr) {
    console.log('  ⚠️  Request no encontrada — skip')
    return 'skipped'
  }
  if (psr.status !== 'PENDING') {
    console.log(`  ⚠️  Status=${psr.status} (no PENDING) — skip (idempotencia)`)
    return 'skipped'
  }
  if (psr.confirmedClasses.length > 0) {
    console.log(`  ⚠️  Ya tiene ${psr.confirmedClasses.length} clases vinculadas — skip`)
    return 'skipped'
  }
  if (!psr.purchase.package.isPrivate) {
    console.log('  ⚠️  Purchase no es de paquete private — skip')
    return 'skipped'
  }
  if (psr.purchase.status !== 'ACTIVE') {
    console.log(`  ⚠️  Purchase status=${psr.purchase.status} — skip`)
    return 'skipped'
  }
  if (psr.purchase.classesRemaining < 1) {
    console.log('  ⚠️  Purchase sin créditos — skip')
    return 'skipped'
  }

  const slotPlans = [
    { idx: 1, slot: data.slot1, usesOriginalPurchase: true },
    { idx: 2, slot: data.slot2, usesOriginalPurchase: false },
    { idx: 3, slot: data.slot3, usesOriginalPurchase: false },
  ]

  if (DRY_RUN) {
    for (const p of slotPlans) {
      console.log(
        `  [DRY] slot${p.idx} → Class+Reservation @ ${p.slot.dateTime} (instr=${p.slot.instructorId}) ` +
          `${p.usesOriginalPurchase ? 'usa Purchase original' : 'crea Purchase spawneado ($0, ExcludedPurchase)'}`
      )
    }
    return 'applied'
  }

  await prisma.$transaction(async (tx) => {
    let activePurchaseId = psr.purchaseId

    for (const p of slotPlans) {
      // Determinar / crear el Purchase que respaldará este slot
      if (!p.usesOriginalPurchase) {
        const spawn = await tx.purchase.create({
          data: {
            userId: psr.userId,
            packageId: psr.purchase.packageId,
            classesRemaining: 1,
            expiresAt: psr.purchase.expiresAt,
            discountCode: null,
            originalPrice: psr.purchase.package.price,
            finalPrice: 0,
            status: 'ACTIVE',
            paymentProviderId: null,
          },
        })
        activePurchaseId = spawn.id

        await tx.excludedPurchase.create({
          data: {
            purchaseId: spawn.id,
            reason: 'PRIVATE_FLOW_SPLIT',
            notes: `Spawneado por backfill 3-slot split. Original=${psr.purchaseId}, request=${psr.id}, slot=${p.idx}.`,
            excludedBy: ADMIN_USER_ID,
          },
        })
      } else {
        activePurchaseId = psr.purchaseId
      }

      const createdClass = await tx.class.create({
        data: {
          disciplineId: psr.preferredDisciplineId,
          instructorId: p.slot.instructorId,
          dateTime: new Date(p.slot.dateTime),
          duration: 60,
          maxCapacity: 1,
          currentCount: 0,
          isPrivate: true,
          classType: 'Sesión privada',
          privateSessionRequestId: psr.id,
        },
      })

      await tx.reservation.create({
        data: {
          userId: psr.userId,
          classId: createdClass.id,
          purchaseId: activePurchaseId,
          status: 'CONFIRMED',
        },
      })

      // Decrement + DEPLETED si llega a 0
      const updated = await tx.purchase.update({
        where: { id: activePurchaseId },
        data: { classesRemaining: { decrement: 1 } },
      })
      if (updated.classesRemaining < 0) {
        throw new Error(`INSUFFICIENT_CREDITS en purchase ${activePurchaseId}`)
      }
      if (updated.classesRemaining === 0) {
        await tx.purchase.update({
          where: { id: activePurchaseId },
          data: { status: 'DEPLETED' },
        })
      }
    }

    await tx.privateSessionRequest.update({
      where: { id: psr.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy: ADMIN_USER_ID,
        adminNotes: `Backfill split 3→1+1+1 aplicado ${new Date().toISOString()}`,
      },
    })
  }, { timeout: 14_000 })

  console.log('  ✅ Aplicado: 3 reservas + 2 paquetes spawneados')

  // Email de confirmación (fire-and-forget)
  if (!SKIP_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { id: psr.userId },
      select: { name: true, email: true },
    })
    const instructors = await prisma.instructor.findMany({
      where: {
        id: {
          in: [data.slot1.instructorId, data.slot2.instructorId, data.slot3.instructorId],
        },
      },
      select: { id: true, name: true },
    })
    const instById = new Map(instructors.map((i) => [i.id, i.name]))
    if (user) {
      sendEmail({
        to: user.email,
        subject: 'Tus sesiones privadas están confirmadas',
        html: buildPrivateSessionConfirmationEmail({
          userName: user.name,
          sessions: [data.slot1, data.slot2, data.slot3].map((s) => ({
            disciplineName: data.disciplineName,
            instructorName: instById.get(s.instructorId) ?? '',
            dateTime: formatDateTimeFull(new Date(s.dateTime)),
            duration: 60,
          })),
        }),
      }).catch((err) =>
        console.error(`  ⚠️  Email a ${user.email} falló:`, err)
      )
    }
  }

  return 'applied'
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
