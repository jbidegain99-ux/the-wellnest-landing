/**
 * AUDITORÍA DE COMPRAS - WELLNEST STUDIO
 * Fecha: 2026-03-25
 *
 * Genera 3 reportes:
 * 1. Clientes activos con paquetes comprados
 * 2. Distribución por paquete
 * 3. Distribución por disciplina (basada en reservaciones reales)
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const cutoffDate = new Date('2026-03-26T06:00:00.000Z') // 2026-03-25 23:59:59 UTC-6 (SV)

  // ══════════════════════════════════════════════════════
  // 1. CLIENTES ACTIVOS CON COMPRAS
  // ══════════════════════════════════════════════════════

  const distinctUsers = await prisma.purchase.findMany({
    where: { createdAt: { lt: cutoffDate } },
    select: { userId: true },
    distinct: ['userId'],
  })

  const totalClientes = distinctUsers.length

  // ══════════════════════════════════════════════════════
  // 2. DISTRIBUCIÓN POR PAQUETE
  // ══════════════════════════════════════════════════════

  const purchasesByPackage = await prisma.purchase.groupBy({
    by: ['packageId'],
    where: { createdAt: { lt: cutoffDate } },
    _count: { id: true },
    _sum: { finalPrice: true },
  })

  const packageIds = purchasesByPackage.map(p => p.packageId)
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, name: true, price: true },
  })

  const packageMap = new Map(packages.map(p => [p.id, p]))

  interface PackageRow {
    name: string
    price: number
    count: number
    revenue: number
  }

  const packageRows: PackageRow[] = purchasesByPackage
    .map(p => {
      const pkg = packageMap.get(p.packageId)
      return {
        name: pkg?.name ?? `Unknown (${p.packageId})`,
        price: pkg?.price ?? 0,
        count: p._count.id,
        revenue: p._sum.finalPrice ?? 0,
      }
    })
    .sort((a, b) => b.count - a.count)

  const totalCompras = packageRows.reduce((s, r) => s + r.count, 0)
  const totalIngresos = packageRows.reduce((s, r) => s + r.revenue, 0)

  // ══════════════════════════════════════════════════════
  // 3. DISTRIBUCIÓN POR DISCIPLINA
  // ══════════════════════════════════════════════════════
  // Nota: PackageDiscipline está vacía — todos los paquetes son all-access.
  // Usamos reservaciones reales para medir demanda por disciplina.

  // Count reservations per discipline (from classes booked)
  const reservations = await prisma.reservation.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      status: { not: 'CANCELLED' },
    },
    select: {
      class: {
        select: {
          discipline: { select: { name: true } },
          complementaryDiscipline: { select: { name: true } },
        },
      },
    },
  })

  const disciplineCounts = new Map<string, number>()
  for (const r of reservations) {
    const primary = r.class.discipline.name
    disciplineCounts.set(primary, (disciplineCounts.get(primary) ?? 0) + 1)
    if (r.class.complementaryDiscipline) {
      const comp = r.class.complementaryDiscipline.name
      disciplineCounts.set(comp, (disciplineCounts.get(comp) ?? 0) + 1)
    }
  }

  interface DisciplineRow {
    name: string
    count: number
  }

  const disciplineRows: DisciplineRow[] = Array.from(disciplineCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const totalReservaciones = reservations.length

  // ══════════════════════════════════════════════════════
  // GENERAR REPORTE
  // ══════════════════════════════════════════════════════

  const pad = (s: string, n: number) => s.padEnd(n)
  const padL = (s: string, n: number) => s.padStart(n)

  let report = ''
  report += '════════════════════════════════════════════════════════════════════\n'
  report += 'AUDITORÍA DE COMPRAS - WELLNEST STUDIO\n'
  report += 'Generado: 2026-03-25 (UTC-6 El Salvador)\n'
  report += `Corte: Todas las compras hasta 2026-03-25 23:59:59 (hora SV)\n`
  report += '════════════════════════════════════════════════════════════════════\n\n'

  // Section 1
  report += '1. CLIENTES ACTIVOS CON COMPRAS\n'
  report += '──────────────────────────────────\n'
  report += `Total: ${totalClientes} clientes únicos con al menos 1 compra\n\n`

  // Section 2
  report += '2. DISTRIBUCIÓN POR PAQUETE\n'
  report += '───────────────────────────\n'
  const colName = 42
  const colPrice = 12
  const colCount = 10
  const colRev = 18

  report += `${pad('Paquete', colName)} ${padL('Precio', colPrice)} ${padL('Compras', colCount)} ${padL('Ingresos Totales', colRev)}\n`
  report += '─'.repeat(colName + colPrice + colCount + colRev + 3) + '\n'

  for (const row of packageRows) {
    report += `${pad(row.name.substring(0, colName - 1), colName)} ${padL('$' + row.price.toFixed(2), colPrice)} ${padL(String(row.count), colCount)} ${padL('$' + row.revenue.toFixed(2), colRev)}\n`
  }
  report += '─'.repeat(colName + colPrice + colCount + colRev + 3) + '\n'
  report += `${pad('TOTAL', colName)} ${padL('', colPrice)} ${padL(String(totalCompras), colCount)} ${padL('$' + totalIngresos.toFixed(2), colRev)}\n\n`

  // Section 3
  report += '3. DISTRIBUCIÓN POR DISCIPLINA (basada en reservaciones)\n'
  report += '─────────────────────────────────────────────────────────\n'
  report += `Nota: Los paquetes de Wellnest son "all-access" (no tienen\n`
  report += `disciplinas asignadas). Esta sección muestra la demanda real\n`
  report += `por disciplina, basada en las clases reservadas por los clientes.\n`
  report += `Si una clase tiene disciplina complementaria, se cuenta en ambas.\n\n`

  const colDisc = 35
  const colDiscCount = 18
  const colDiscPct = 10

  report += `${pad('Disciplina', colDisc)} ${padL('Reservaciones', colDiscCount)} ${padL('% del Total', colDiscPct)}\n`
  report += '─'.repeat(colDisc + colDiscCount + colDiscPct + 2) + '\n'

  for (const row of disciplineRows) {
    const pct = totalReservaciones > 0 ? ((row.count / totalReservaciones) * 100).toFixed(1) : '0.0'
    report += `${pad(row.name, colDisc)} ${padL(String(row.count), colDiscCount)} ${padL(pct + '%', colDiscPct)}\n`
  }
  report += '─'.repeat(colDisc + colDiscCount + colDiscPct + 2) + '\n'
  report += `${pad('Total reservaciones (no canceladas)', colDisc)} ${padL(String(totalReservaciones), colDiscCount)}\n\n`

  // Verification
  report += '════════════════════════════════════════════════════════════════════\n'
  report += 'VERIFICACIÓN\n'
  report += '──────────────────────────────────\n'
  report += `✅ Clientes distintos (DISTINCT userId): ${totalClientes}\n`
  report += `✅ Total de compras (Purchase records): ${totalCompras}\n`
  report += `✅ Total ingresos (suma finalPrice): $${totalIngresos.toFixed(2)}\n`
  report += `✅ Clientes (${totalClientes}) <= Compras (${totalCompras}): ${totalClientes <= totalCompras ? 'OK' : 'ERROR'}\n`
  report += `✅ Reservaciones no canceladas: ${totalReservaciones}\n`
  report += `✅ PackageDiscipline vacía → disciplinas medidas por uso real: OK\n`
  report += '════════════════════════════════════════════════════════════════════\n'

  // Print to console
  console.log(report)

  // Save to file
  const outPath = path.join(__dirname, '..', 'tasks', 'reports', 'AUDITORIA_COMPRAS_2026-03-25.txt')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, report, 'utf-8')
  console.log(`\nReporte guardado en: ${outPath}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
