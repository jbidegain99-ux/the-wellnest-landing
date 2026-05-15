/**
 * Migración one-shot: Private Flow pasa de 1 a 3 sesiones por compra.
 *
 * Sólo migra compras ACTIVE con classesRemaining=1 de paquetes isPrivate
 * que NO tengan una PrivateSessionRequest en estado PENDING o CONFIRMED.
 * Las compras con solicitud en curso se omiten y se loguean para revisión
 * manual (siguen funcionando con flujo legacy de 1 sesión).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n→ Buscando compras Private Flow vigentes a migrar...\n')

  const candidates = await prisma.purchase.findMany({
    where: {
      status: 'ACTIVE',
      classesRemaining: 1,
      package: { isPrivate: true },
      NOT: {
        privateSessionRequests: {
          some: { status: { in: ['PENDING', 'CONFIRMED'] } },
        },
      },
    },
    include: {
      user: { select: { email: true, name: true } },
      package: { select: { name: true } },
    },
  })

  const skipped = await prisma.purchase.findMany({
    where: {
      status: 'ACTIVE',
      classesRemaining: 1,
      package: { isPrivate: true },
      privateSessionRequests: {
        some: { status: { in: ['PENDING', 'CONFIRMED'] } },
      },
    },
    include: {
      user: { select: { email: true } },
      privateSessionRequests: { select: { id: true, status: true } },
    },
  })

  console.log(`Candidatos a migrar: ${candidates.length}`)
  for (const c of candidates) {
    console.log(`  - ${c.id}  ${c.user.name ?? c.user.email}  (${c.package.name})`)
  }
  console.log(`\nOmitidas (con solicitud activa): ${skipped.length}`)
  for (const s of skipped) {
    const reqs = s.privateSessionRequests.map((r) => `${r.id}:${r.status}`).join(', ')
    console.log(`  - ${s.id}  ${s.user.email}  [${reqs}]`)
  }

  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN] No se hicieron cambios.')
    return
  }

  if (candidates.length === 0) {
    console.log('\nNada que migrar.')
    return
  }

  const result = await prisma.purchase.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { classesRemaining: 3 },
  })
  console.log(`\n✓ Actualizadas ${result.count} compras a classesRemaining=3`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
