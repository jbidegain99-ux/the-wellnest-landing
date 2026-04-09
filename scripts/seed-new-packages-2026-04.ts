/**
 * Seed script for two new packages added 2026-04-09:
 *
 *   1. Ease In — $25, 2 clases, 30 días, SOLO Pilates/Yoga/Soundbath
 *   2. Private Flow — $45, 1 clase privada 1:1, 30 días, isPrivate=true
 *
 * Uses upsert by slug so it's idempotent. PackageDiscipline rows for Ease In
 * are deduped via @@unique([packageId, disciplineId]).
 *
 * Uso: npx tsx scripts/seed-new-packages-2026-04.ts
 */

import { prisma } from '../src/lib/prisma'

// Slugs de disciplinas confirmados contra la DB 2026-04-09
const EASE_IN_DISCIPLINE_SLUGS = ['pilates', 'yoga', 'soundbath'] as const

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
  isPrivate: boolean
}) {
  const existing = await prisma.package.findFirst({ where: { slug: data.slug } })
  if (existing) {
    const updated = await prisma.package.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        subtitle: data.subtitle,
        shortDescription: data.shortDescription,
        fullDescription: data.fullDescription,
        classCount: data.classCount,
        price: data.price,
        validityDays: data.validityDays,
        bulletsTop: data.bulletsTop,
        bulletsBottom: data.bulletsBottom,
        order: data.order,
        isActive: true,
        isPrivate: data.isPrivate,
      },
    })
    console.log(`✏  Updated package: ${updated.name} (${updated.id})`)
    return updated
  }
  const created = await prisma.package.create({
    data: {
      slug: data.slug,
      name: data.name,
      subtitle: data.subtitle,
      shortDescription: data.shortDescription,
      fullDescription: data.fullDescription,
      classCount: data.classCount,
      price: data.price,
      validityDays: data.validityDays,
      bulletsTop: data.bulletsTop,
      bulletsBottom: data.bulletsBottom,
      order: data.order,
      isActive: true,
      isPrivate: data.isPrivate,
    },
  })
  console.log(`✅  Created package: ${created.name} (${created.id})`)
  return created
}

async function linkDisciplines(packageId: string, disciplineSlugs: readonly string[]) {
  for (const slug of disciplineSlugs) {
    const discipline = await prisma.discipline.findUnique({ where: { slug } })
    if (!discipline) {
      console.error(`❌  Discipline not found: ${slug}`)
      continue
    }
    await prisma.packageDiscipline.upsert({
      where: {
        packageId_disciplineId: { packageId, disciplineId: discipline.id },
      },
      update: {},
      create: { packageId, disciplineId: discipline.id },
    })
    console.log(`   ↳ linked discipline: ${discipline.name} (${slug})`)
  }
}

async function main() {
  console.log('🌱 Seeding new packages (2026-04)\n')

  // ──────────────────────────────────────────────────────────────────
  // 1. Ease In — $25, 2 clases, restringido a Pilates/Yoga/Soundbath
  // ──────────────────────────────────────────────────────────────────
  const easeIn = await upsertPackage({
    slug: 'ease-in',
    name: 'Ease In',
    subtitle: 'Dos oportunidades para volver a ti',
    shortDescription: 'Dos oportunidades para volver a ti',
    fullDescription:
      'Una opción práctica y accesible para regalarte dos espacios de pausa, ' +
      'movimiento y bienestar. Perfecto para explorar disciplinas que nutren el ' +
      'cuerpo, calman la mente y te ayudan a reconectar contigo.',
    classCount: 2,
    price: 25.0,
    validityDays: 30,
    bulletsTop: [
      '2 clases',
      '30 días de vigencia',
      'Aplica solo para Pilates, Yoga y Soundbath',
    ],
    bulletsBottom: [
      'Ideal para probar nuevas disciplinas',
      'Disponible en Pilates, Yoga y Soundbath',
      'Reserva fácil desde la app',
      'Cancela tu clase 8 horas antes',
    ],
    order: -2, // Primero en la lista pública
    isPrivate: false,
  })
  await linkDisciplines(easeIn.id, EASE_IN_DISCIPLINE_SLUGS)
  console.log()

  // ──────────────────────────────────────────────────────────────────
  // 2. Private Flow — $45, 1 clase privada 1:1
  // ──────────────────────────────────────────────────────────────────
  const privateFlow = await upsertPackage({
    slug: 'private-flow',
    name: 'Private Flow (1 clase)',
    subtitle: 'Una sesión personalizada para ti',
    shortDescription: 'Una sesión personalizada para ti',
    fullDescription:
      'Una sesión diseñada según tus necesidades, ritmo y objetivos. Ideal para ' +
      'profundizar en tu práctica, recibir guía cercana y vivir un espacio de ' +
      'movimiento totalmente adaptado a ti.',
    classCount: 1,
    price: 45.0,
    validityDays: 30,
    bulletsTop: [
      '1 clase privada',
      'Atención 1:1',
      'Experiencia personalizada',
    ],
    bulletsBottom: [
      'Ideal para acompañamiento personalizado',
      'Todas las disciplinas disponibles según enfoque',
      'Reserva fácil desde la app',
      'Reprograma con 8 horas de anticipación',
    ],
    order: -1, // Segundo en la lista pública (después de Ease In)
    isPrivate: true,
  })
  // Private Flow no tiene restricción de disciplina: el usuario elige al
  // solicitar la sesión. No creamos PackageDiscipline entries.
  console.log()

  console.log('✅ Seed complete.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
