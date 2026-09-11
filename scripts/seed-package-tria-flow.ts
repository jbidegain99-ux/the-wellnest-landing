/**
 * Seed: TRIA Flow (4 clases) — 2026-09-10
 *
 *   $30, 4 clases, 30 días, SOLO Yoga / Pilates / Terapia de Sonido.
 *
 * Tercer paquete de la familia "tres disciplinas" (Trinity Balance 12 y
 * Mind Body Soul 24, ver scripts/seed-packages-2026-08.ts). La restricción se
 * aplica vía PackageDiscipline; la valida validatePackageAllowsClass() en
 * src/app/api/reservations/route.ts.
 *
 * Va en order 2: el listado público se ordena de menor a mayor precio
 * (15 → 30 → 45 → 49.99 → …) y ese slot quedó libre al desactivarse 'ease-in',
 * así que no hace falta reordenar el resto.
 *
 * Idempotente: upsert por slug. Re-ejecutar es seguro.
 *
 * Uso: npx tsx scripts/seed-package-tria-flow.ts
 */

import './loadEnv'
import { prisma } from '../src/lib/prisma'

const DISCIPLINE_SLUGS = ['yoga', 'pilates', 'soundbath'] as const

const SPEC = {
  slug: 'tria-flow-4',
  name: 'TRIA Flow (4 clases)',
  subtitle: 'Combina movimiento, pausa y conexión a tu manera',
  shortDescription: 'Combina movimiento, pausa y conexión a tu manera',
  fullDescription:
    'Un paquete flexible para que explores distintas formas de moverte, ' +
    'conectar y nutrir tu bienestar. Puedes distribuir tus 4 clases como ' +
    'prefieras entre las tres disciplinas incluidas.',
  classCount: 4,
  price: 30.0,
  validityDays: 30,
  bulletsTop: [
    '4 clases',
    'Combina entre Yoga, Pilates y Terapia de Sonido',
    '30 días de vigencia',
  ],
  bulletsBottom: [
    'Yoga',
    'Pilates',
    'Terapia de Sonido',
    'Reserva fácil desde la app',
    'Cancela tu clase 8 horas antes',
  ],
  order: 2,
}

async function main() {
  console.log('🌱 Seed TRIA Flow (4 clases)\n')

  const payload = {
    ...SPEC,
    currency: 'USD',
    isActive: true,
    isHidden: false,
    isPrivate: false,
  }

  const existing = await prisma.package.findFirst({ where: { slug: SPEC.slug } })
  const pkg = existing
    ? await prisma.package.update({ where: { id: existing.id }, data: payload })
    : await prisma.package.create({ data: payload })
  console.log(`${existing ? '✏  Actualizado' : '✅ Creado'}: ${pkg.name} (${pkg.id})`)

  for (const slug of DISCIPLINE_SLUGS) {
    const discipline = await prisma.discipline.findUnique({ where: { slug } })
    if (!discipline) throw new Error(`Discipline no encontrada: ${slug}`)
    await prisma.packageDiscipline.upsert({
      where: { packageId_disciplineId: { packageId: pkg.id, disciplineId: discipline.id } },
      update: {},
      create: { packageId: pkg.id, disciplineId: discipline.id },
    })
    console.log(`   ↳ disciplina vinculada: ${discipline.name} (${slug})`)
  }

  console.log('\n— Listado público resultante —')
  const publicPkgs = await prisma.package.findMany({
    where: { isActive: true, isHidden: false },
    orderBy: { order: 'asc' },
    select: { order: true, slug: true, name: true, price: true },
  })
  for (const p of publicPkgs) {
    console.log(`   ${String(p.order).padStart(2)} | $${String(p.price).padStart(6)} | ${p.name}`)
  }

  console.log('\n✅ Seed completo.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
