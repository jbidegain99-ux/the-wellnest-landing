#!/usr/bin/env npx tsx
/**
 * Migración: Extender vigencia de todos los paquetes comprados ANTES del
 * 9 de marzo 2026 hasta el 9 de abril 2026 23:59:59 hora de El Salvador.
 *
 * Motivo: Los usuarios compraron paquetes en preventa pero las clases
 * comenzaron hasta el 9 de marzo, perdiendo días de vigencia.
 *
 * Uso:
 *   npx tsx scripts/migrate-extend-vigency.ts
 *   npx tsx scripts/migrate-extend-vigency.ts --dry-run
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// 9 de marzo 2026, 00:00 El Salvador = 06:00 UTC
const CUTOFF_UTC = new Date('2026-03-09T06:00:00.000Z')

// 9 de abril 2026, 23:59:59 El Salvador = 10 abril 05:59:59 UTC
const NEW_EXPIRY_UTC = new Date('2026-04-10T05:59:59.000Z')

interface MigrationEntry {
  purchaseId: string
  userId: string
  userEmail: string
  packageName: string
  oldExpiresAt: string
  newExpiresAt: string
  action: 'updated' | 'skipped_already_extended' | 'skipped_later_expiry'
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')

  console.log('='.repeat(60))
  console.log('  MIGRACIÓN: Extender Vigencia Pre-Marzo')
  console.log(isDryRun ? '  *** MODO DRY-RUN — No se harán cambios ***' : '')
  console.log('='.repeat(60))
  console.log(`  Corte:        < ${CUTOFF_UTC.toISOString()}`)
  console.log(`  Nueva expiry: ${NEW_EXPIRY_UTC.toISOString()} (9-Abr 23:59:59 SV)`)
  console.log(`  Ejecutado:    ${new Date().toISOString()}`)
  console.log()

  const purchases = await prisma.purchase.findMany({
    where: {
      createdAt: { lt: CUTOFF_UTC },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      package: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`  Compras encontradas antes de corte: ${purchases.length}`)
  console.log()

  const log: MigrationEntry[] = []
  let updatedCount = 0
  let skippedCount = 0

  for (const p of purchases) {
    const entry: MigrationEntry = {
      purchaseId: p.id,
      userId: p.userId,
      userEmail: p.user.email,
      packageName: p.package.name,
      oldExpiresAt: p.expiresAt.toISOString(),
      newExpiresAt: NEW_EXPIRY_UTC.toISOString(),
      action: 'updated',
    }

    // Already at or beyond target date — skip
    if (p.expiresAt >= NEW_EXPIRY_UTC) {
      entry.action = 'skipped_later_expiry'
      skippedCount++
      console.log(`  SKIP ${p.id} (${p.user.email}) — expiry ${p.expiresAt.toISOString()} already >= target`)
    } else {
      // Update
      if (!isDryRun) {
        await prisma.purchase.update({
          where: { id: p.id },
          data: { expiresAt: NEW_EXPIRY_UTC },
        })
      }
      updatedCount++
      console.log(`  ${isDryRun ? 'WOULD UPDATE' : 'UPDATED'} ${p.id} (${p.user.email}) — ${p.expiresAt.toISOString()} → ${NEW_EXPIRY_UTC.toISOString()}`)
    }

    log.push(entry)
  }

  // Save log
  const outputDir = '/mnt/user-data/outputs'
  const logData = {
    generatedAt: new Date().toISOString(),
    isDryRun,
    cutoffDate: CUTOFF_UTC.toISOString(),
    newExpiryDate: NEW_EXPIRY_UTC.toISOString(),
    summary: {
      totalFound: purchases.length,
      updated: updatedCount,
      skipped: skippedCount,
    },
    entries: log,
  }

  const filename = `migration-extend-vigency-log${isDryRun ? '-dryrun' : ''}.json`

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    const outputPath = path.join(outputDir, filename)
    fs.writeFileSync(outputPath, JSON.stringify(logData, null, 2))
    console.log(`\n  Log guardado en: ${outputPath}`)
  } catch {
    const localPath = path.join(process.cwd(), filename)
    fs.writeFileSync(localPath, JSON.stringify(logData, null, 2))
    console.log(`\n  Log guardado en: ${localPath}`)
  }

  console.log()
  console.log('='.repeat(60))
  console.log('  RESUMEN')
  console.log('='.repeat(60))
  console.log(`  Total encontradas: ${purchases.length}`)
  console.log(`  Actualizadas:      ${updatedCount}`)
  console.log(`  Omitidas:          ${skippedCount}`)
  if (isDryRun) {
    console.log()
    console.log('  Para aplicar cambios, ejecutar sin --dry-run')
  }
  console.log()

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})
