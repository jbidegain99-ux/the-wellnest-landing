/**
 * Seed: Trinity Flow (bundle) + Flow Viajero
 *
 * Crea 3 paquetes child ocultos (trinity-pole-2, trinity-pilates-2,
 * trinity-yoga-2), el bundle visible Trinity Flow, y Flow Viajero.
 *
 * Idempotente: usa upsert por slug. Re-ejecutar es seguro.
 *
 * Uso: npx tsx scripts/seed-trinity-and-viajero.ts
 */

import { prisma } from '../src/lib/prisma'

interface ChildSpec {
  slug: string
  name: string
  disciplineSlug: string
}

const CHILDREN: ChildSpec[] = [
  { slug: 'trinity-pole-2', name: 'Trinity — Pole (2 clases)', disciplineSlug: 'pole' },
  { slug: 'trinity-pilates-2', name: 'Trinity — Pilates (2 clases)', disciplineSlug: 'pilates' },
  { slug: 'trinity-yoga-2', name: 'Trinity — Yoga (2 clases)', disciplineSlug: 'yoga' },
]

async function upsertPackage(data: {
  slug: string
  name: string
  subtitle: string
  shortDescription: string
  fullDescription: string
  classCount: number
  price: number
  validityDays: number
  bulletsTop: string[]
  bulletsBottom: string[]
  order: number
  isHidden?: boolean
  bundleChildSlugs?: string[]
}) {
  const existing = await prisma.package.findFirst({ where: { slug: data.slug } })
  const payload = {
    slug: data.slug,
    name: data.name,
    subtitle: data.subtitle,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription,
    classCount: data.classCount,
    price: data.price,
    currency: 'USD',
    validityDays: data.validityDays,
    bulletsTop: data.bulletsTop,
    bulletsBottom: data.bulletsBottom,
    order: data.order,
    isActive: true,
    isHidden: data.isHidden ?? false,
    bundleChildSlugs: data.bundleChildSlugs ?? [],
  }
  if (existing) {
    const updated = await prisma.package.update({ where: { id: existing.id }, data: payload })
    console.log(`✏  Updated: ${updated.name} (${updated.id})`)
    return updated
  }
  const created = await prisma.package.create({ data: payload })
  console.log(`✅ Created: ${created.name} (${created.id})`)
  return created
}

async function linkDiscipline(packageId: string, disciplineSlug: string) {
  const discipline = await prisma.discipline.findUnique({ where: { slug: disciplineSlug } })
  if (!discipline) throw new Error(`Discipline not found: ${disciplineSlug}`)
  await prisma.packageDiscipline.upsert({
    where: { packageId_disciplineId: { packageId, disciplineId: discipline.id } },
    update: {},
    create: { packageId, disciplineId: discipline.id },
  })
  console.log(`   ↳ linked ${discipline.name}`)
}

async function reorderExistingPackages() {
  const remap: Array<{ slug: string; order: number }> = [
    { slug: 'ease-in', order: -2 },
    { slug: 'private-flow', order: -1 },
    { slug: 'drop-in-class', order: 1 },
    { slug: 'mini-flow-4', order: 2 },
    { slug: 'balance-pass-8', order: 4 },
    { slug: 'energia-total-12', order: 5 },
    { slug: 'apertura-full-access-24', order: 6 },
    { slug: 'wellnest-trimestral-80', order: 7 },
    { slug: 'special-balance-5', order: 9 },
  ]
  for (const { slug, order } of remap) {
    const r = await prisma.package.updateMany({ where: { slug }, data: { order } })
    if (r.count > 0) console.log(`   ↻ reordered ${slug} → ${order}`)
  }
}

async function main() {
  console.log('🌱 Seeding Trinity Flow (bundle) + Flow Viajero\n')

  console.log('— Reordering existing packages —')
  await reorderExistingPackages()
  console.log()

  console.log('— Children (hidden) —')
  for (const child of CHILDREN) {
    const pkg = await upsertPackage({
      slug: child.slug,
      name: child.name,
      subtitle: 'Componente de Trinity Flow',
      shortDescription: 'Componente de Trinity Flow',
      fullDescription: 'Paquete interno generado por la compra de Trinity Flow. No se vende directamente.',
      classCount: 2,
      price: 0,
      validityDays: 30,
      bulletsTop: [],
      bulletsBottom: [],
      order: 999,
      isHidden: true,
    })
    await linkDiscipline(pkg.id, child.disciplineSlug)
  }
  console.log()

  console.log('— Trinity Flow (bundle visible) —')
  const trinity = await upsertPackage({
    slug: 'trinity-flow-6',
    name: 'Trinity Flow (6 clases)',
    subtitle: 'Una combinación pensada para explorar distintas formas de bienestar',
    shortDescription: 'Una combinación pensada para explorar distintas formas de bienestar',
    fullDescription: 'Un paquete creado para que vivas una experiencia variada dentro de Wellnest, combinando fuerza, control, movilidad y conexión.',
    classCount: 6,
    price: 60,
    validityDays: 30,
    bulletsTop: ['2 clases de Pole', '2 clases de Pilates', '2 clases de Yoga'],
    bulletsBottom: [
      'Incluye 2 Pilates, 2 Yoga y 2 Pole',
      'Debe utilizarse bajo esta combinación',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
    order: 3,
    bundleChildSlugs: ['trinity-pole-2', 'trinity-pilates-2', 'trinity-yoga-2'],
  })
  await linkDiscipline(trinity.id, 'pole')
  await linkDiscipline(trinity.id, 'pilates')
  await linkDiscipline(trinity.id, 'yoga')
  console.log()

  console.log('— Flow Viajero (paquete normal) —')
  await upsertPackage({
    slug: 'flow-viajero-40',
    name: 'Flow Viajero (40 clases)',
    subtitle: 'Tu práctica, tu ritmo, tu espacio',
    shortDescription: 'Tu práctica, tu ritmo, tu espacio',
    fullDescription: 'Pensado para acompañarte durante dos meses con acceso a una experiencia más completa dentro de Wellnest. Ideal para quienes quieren integrar el movimiento y el bienestar como parte real de su rutina.',
    classCount: 40,
    price: 215,
    validityDays: 60,
    bulletsTop: ['40 clases', '2 meses de vigencia', 'Todas las disciplinas incluidas'],
    bulletsBottom: [
      'Acceso a todas las disciplinas',
      'Perfecto para profundizar en tu práctica',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
    order: 8,
  })

  console.log('\n✅ Seed complete.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
