#!/usr/bin/env npx tsx
/**
 * Auditoría: Identificar todas las compras (Purchase) creadas ANTES del
 * 9 de marzo de 2026 00:00 hora de El Salvador (= 2026-03-09T06:00:00Z).
 *
 * Estas compras corresponden a preventa — los usuarios no podían usar sus
 * paquetes hasta que comenzaron las clases el 9 de marzo.
 *
 * Uso:
 *   npx tsx scripts/audit-pre-march-packages.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// 9 de marzo 2026, 00:00 El Salvador = 06:00 UTC
const CUTOFF_UTC = new Date('2026-03-09T06:00:00.000Z')

interface UserSummary {
  userId: string
  userName: string | null
  email: string
  purchases: {
    purchaseId: string
    packageName: string
    packageId: string
    classesRemaining: number
    expiresAt: string
    createdAt: string
    status: string
    finalPrice: number
  }[]
  purchaseCount: number
  totalClassesRemaining: number
}

async function main(): Promise<void> {
  console.log('='.repeat(60))
  console.log('  AUDITORÍA: Compras Pre-9 de Marzo 2026')
  console.log('='.repeat(60))
  console.log(`  Fecha de corte: ${CUTOFF_UTC.toISOString()} (9-Mar 00:00 SV)`)
  console.log(`  Ejecutado: ${new Date().toISOString()}`)
  console.log()

  const purchases = await prisma.purchase.findMany({
    where: {
      createdAt: { lt: CUTOFF_UTC },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      package: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`  Total de compras encontradas: ${purchases.length}`)

  // Group by user
  const userMap = new Map<string, UserSummary>()

  for (const p of purchases) {
    let entry = userMap.get(p.userId)
    if (!entry) {
      entry = {
        userId: p.userId,
        userName: p.user.name,
        email: p.user.email,
        purchases: [],
        purchaseCount: 0,
        totalClassesRemaining: 0,
      }
      userMap.set(p.userId, entry)
    }

    entry.purchases.push({
      purchaseId: p.id,
      packageName: p.package.name,
      packageId: p.packageId,
      classesRemaining: p.classesRemaining,
      expiresAt: p.expiresAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      status: p.status,
      finalPrice: p.finalPrice,
    })
    entry.purchaseCount++
    entry.totalClassesRemaining += p.classesRemaining
  }

  const users = Array.from(userMap.values())

  console.log(`  Usuarios afectados: ${users.length}`)
  console.log()

  // Print summary per user
  for (const user of users) {
    console.log(`  ${user.userName || '(sin nombre)'} <${user.email}>`)
    console.log(`    Compras: ${user.purchaseCount}, Clases restantes: ${user.totalClassesRemaining}`)
    for (const p of user.purchases) {
      console.log(`      - ${p.packageName} | ${p.classesRemaining} clases | expira: ${p.expiresAt} | status: ${p.status}`)
    }
    console.log()
  }

  // Save JSON output
  const outputDir = '/mnt/user-data/outputs'
  const outputPath = path.join(outputDir, 'audit-pre-march-packages.json')

  const report = {
    generatedAt: new Date().toISOString(),
    cutoffDate: CUTOFF_UTC.toISOString(),
    summary: {
      totalUsers: users.length,
      totalPurchases: purchases.length,
      totalClassesRemaining: users.reduce((sum, u) => sum + u.totalClassesRemaining, 0),
      dateRange: purchases.length > 0
        ? {
            earliest: purchases[0].createdAt.toISOString(),
            latest: purchases[purchases.length - 1].createdAt.toISOString(),
          }
        : null,
    },
    users,
  }

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
    console.log(`  Reporte guardado en: ${outputPath}`)
  } catch (err) {
    console.log(`  No se pudo escribir en ${outputPath}, guardando localmente...`)
    const localPath = path.join(process.cwd(), 'audit-pre-march-packages.json')
    fs.writeFileSync(localPath, JSON.stringify(report, null, 2))
    console.log(`  Reporte guardado en: ${localPath}`)
  }

  console.log()
  console.log('='.repeat(60))
  console.log('  RESUMEN')
  console.log('='.repeat(60))
  console.log(`  Usuarios afectados:     ${report.summary.totalUsers}`)
  console.log(`  Compras totales:        ${report.summary.totalPurchases}`)
  console.log(`  Clases restantes total: ${report.summary.totalClassesRemaining}`)
  if (report.summary.dateRange) {
    console.log(`  Compra más antigua:     ${report.summary.dateRange.earliest}`)
    console.log(`  Compra más reciente:    ${report.summary.dateRange.latest}`)
  }
  console.log()

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})
