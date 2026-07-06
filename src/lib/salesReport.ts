/**
 * Reporte de Ventas mensual — cálculo + Excel + HTML del correo.
 *
 * Port generalizado de scripts/report-ventas-mayo-2026.ts, parametrizado por
 * mes calendario SV para poder correrlo como cron (día 1) o por script.
 *
 * Hojas del Excel:
 *   1. Resumen Ejecutivo (incluye ingresos por método de pago)
 *   2. Detalle Diario
 *   3. Resumen Semanal (semanas Lunes-Domingo en hora SV, parciales al inicio/fin)
 *   4. Detalle Paquetes
 *   5. Top 10 Clientes
 *   6. % Ventas por Disciplina + Pagos a Instructores
 *   7. Ocupación por Clase (Disciplina × Semana + detalle por clase)
 *   8. Listado Completo de Ventas
 *
 * Filtros (idénticos al reporte de mayo):
 *   - Solo compras pagadas (finalPrice > 0)
 *   - Excluye usuarios test (EXCLUDED_USER_IDS)
 *   - Aplica ExcludedPurchase (exclusiones financieras)
 *   - Excluye clases canceladas y privadas (1:1) en ocupación
 *
 * Diferencia vs mayo: los pagos a instructores de la hoja 6 ya no se leen del
 * Excel manual de Downloads — se calculan desde la DB con la misma escala del
 * cron de pagos (src/lib/instructorPayments.ts), cubriendo a todos los
 * instructores.
 */

import type { PrismaClient } from '@prisma/client'
import { ReservationStatus } from '@prisma/client'
import * as XLSX from 'xlsx'
import { EXCLUDED_USER_IDS } from '@/lib/constants'
import { computeInstructorPayments } from '@/lib/instructorPayments'

const IVA_RATE = 0.13

const MONTHS_ES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface MonthBounds {
  start: Date
  end: Date // exclusivo (día 1 del mes siguiente, 00:00 SV)
  label: string // p.ej. "Junio 2026"
}

interface SalesWeek {
  idx: number
  label: string
  start: Date
  end: Date // exclusivo
}

interface DailyAgg {
  label: string
  dateKey: string
  revenue: number
  orders: number
  customers: number
}

interface WeeklyAgg {
  label: string
  revenue: number
  orders: number
  customers: number
}

interface PkgStat {
  rank: number
  packageName: string
  disciplines: string[]
  unitsSold: number
  totalRevenue: number
  unitPrice: number
  pctTotal: number
}

interface CustomerStat {
  rank: number
  userName: string
  userEmail: string
  totalSpent: number
  orderCount: number
  packages: string[]
  pctTotal: number
}

interface DisciplineRevenueRow {
  name: string
  revenue: number
}

interface PaymentMethodAgg {
  method: string
  revenue: number
  orders: number
}

interface InstructorPayByDiscipline {
  monto: number
  aPagar: number
  rentaRetenida: number
  clases: number
}

interface ClassOccRow {
  dateTime: Date
  instructor: string
  classType: string
  capacity: number
  asistieron: number
}

interface WeekBucket {
  rows: ClassOccRow[]
  capacity: number
  asistieron: number
}

interface DisciplineOccupancy {
  name: string
  weeks: Map<number, WeekBucket>
  capacity: number
  asistieron: number
  classCount: number
}

interface SaleRow {
  createdAt: Date
  userName: string
  userEmail: string
  packageName: string
  originalPrice: number
  finalPrice: number
  discountCode: string
  method: string
  status: string
  classesRemaining: number
  classCount: number
  expiresAt: Date
}

export interface SalesReportData {
  bounds: MonthBounds
  weeks: SalesWeek[]
  totalGross: number
  totalIva: number
  totalNet: number
  orderCount: number
  uniqueCustomers: number
  avgTicket: number
  monthOccPct: number
  dailyAgg: DailyAgg[]
  weeklyAgg: WeeklyAgg[]
  packageDistribution: PkgStat[]
  topCustomers: CustomerStat[]
  discRevenueRows: DisciplineRevenueRow[]
  unattributedRevenue: number
  buyersWithReservations: number
  buyersWithoutReservations: number
  byMethod: PaymentMethodAgg[]
  instrPayments: Map<string, InstructorPayByDiscipline>
  instrTotals: { monto: number; aPagar: number; rentaRetenida: number }
  occupancy: DisciplineOccupancy[]
  sales: SaleRow[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function svLocal(dt: Date): Date {
  return new Date(dt.getTime() - 6 * 60 * 60 * 1000)
}

function fmtDateSV(d: Date): string {
  const sv = svLocal(d)
  return `${sv.getUTCFullYear()}-${String(sv.getUTCMonth() + 1).padStart(2, '0')}-${String(sv.getUTCDate()).padStart(2, '0')}`
}

function fmtTimeSV(d: Date): string {
  const sv = svLocal(d)
  return `${String(sv.getUTCHours()).padStart(2, '0')}:${String(sv.getUTCMinutes()).padStart(2, '0')}`
}

function fmtDateShort(d: Date): string {
  const sv = svLocal(d)
  return `${String(sv.getUTCDate()).padStart(2, '0')}/${String(sv.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtTimeAmPm(d: Date): string {
  const sv = svLocal(d)
  let h = sv.getUTCHours()
  const m = sv.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

export function classifyPayment(pid: string | null): string {
  if (!pid) return 'Offline (admin)'
  if (pid.startsWith('payway_')) return 'PayWay'
  if (pid === 'manual_payment') return 'Manual'
  if (pid.startsWith('trial_')) return 'Trial'
  return 'Otro'
}

/**
 * Semanas Lunes-Domingo (hora SV) dentro del mes; la primera y última pueden
 * ser parciales. Se usan tanto para el resumen semanal como para el pivot de
 * ocupación.
 */
function buildWeeks(bounds: MonthBounds): SalesWeek[] {
  const DAY = 24 * 3600 * 1000
  const weeks: SalesWeek[] = []
  let cursor = bounds.start
  let idx = 1
  while (cursor < bounds.end) {
    const dowSV = svLocal(cursor).getUTCDay() // 0=Dom ... 6=Sáb
    const daysToNextMonday = dowSV === 0 ? 1 : 8 - dowSV
    const nextMonday = new Date(cursor.getTime() + daysToNextMonday * DAY)
    const end = nextMonday < bounds.end ? nextMonday : bounds.end
    const first = svLocal(cursor)
    const lastInclusive = svLocal(new Date(end.getTime() - DAY))
    const mFirst = MONTHS_ES_SHORT[first.getUTCMonth()]
    const label = `Semana ${idx} (${first.getUTCDate()}-${lastInclusive.getUTCDate()} ${mFirst})`
    weeks.push({ idx, label, start: cursor, end })
    cursor = end
    idx++
  }
  return weeks
}

export async function computeSalesReport(prisma: PrismaClient, bounds: MonthBounds): Promise<SalesReportData> {
  const weeks = buildWeeks(bounds)

  const excluded = await prisma.excludedPurchase.findMany({ select: { purchaseId: true } })
  const excludedPurchaseIds = excluded.map(e => e.purchaseId)

  const disciplines = await prisma.discipline.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  const discIdToName = new Map(disciplines.map(d => [d.id, d.name]))

  const purchases = await prisma.purchase.findMany({
    where: {
      userId: { notIn: EXCLUDED_USER_IDS },
      createdAt: { gte: bounds.start, lt: bounds.end },
      finalPrice: { gt: 0 },
      ...(excludedPurchaseIds.length > 0 && { id: { notIn: excludedPurchaseIds } }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      package: {
        select: {
          id: true,
          name: true,
          price: true,
          classCount: true,
          disciplines: { include: { discipline: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // ── Atribución por disciplina (Opción A: reservas reales del comprador) ──
  const buyerIds = Array.from(new Set(purchases.map(p => p.userId)))
  const buyerReservations = buyerIds.length === 0
    ? []
    : await prisma.reservation.findMany({
        where: {
          userId: { in: buyerIds },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ATTENDED, ReservationStatus.NO_SHOW] },
          class: {
            dateTime: { gte: bounds.start, lt: bounds.end },
            isCancelled: false,
          },
        },
        select: {
          userId: true,
          class: { select: { disciplineId: true, complementaryDisciplineId: true } },
        },
      })

  const userDisciplineWeights = new Map<string, Map<string, number>>()
  for (const r of buyerReservations) {
    if (!userDisciplineWeights.has(r.userId)) {
      userDisciplineWeights.set(r.userId, new Map())
    }
    const map = userDisciplineWeights.get(r.userId)!
    const isDouble =
      r.class.complementaryDisciplineId &&
      r.class.complementaryDisciplineId !== r.class.disciplineId
    const ids: string[] = [r.class.disciplineId]
    if (isDouble) ids.push(r.class.complementaryDisciplineId!)
    const weightPerDiscipline = isDouble ? 0.5 : 1
    for (const id of ids) {
      map.set(id, (map.get(id) ?? 0) + weightPerDiscipline)
    }
  }

  // ── Resumen ejecutivo ──
  const totalGross = round2(purchases.reduce((s, p) => s + p.finalPrice, 0))
  const totalNet = round2(totalGross / (1 + IVA_RATE))
  const totalIva = round2(totalGross - totalNet)
  const orderCount = purchases.length
  const uniqueCustomers = new Set(purchases.map(p => p.userId)).size
  const avgTicket = orderCount > 0 ? round2(totalGross / orderCount) : 0

  // ── Detalle diario ──
  const DAY = 24 * 3600 * 1000
  const daysInMonth = Math.round((bounds.end.getTime() - bounds.start.getTime()) / DAY)
  const monthShort = MONTHS_ES_SHORT[svLocal(bounds.start).getUTCMonth()]
  const dailyAgg: DailyAgg[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStart = new Date(bounds.start.getTime() + (day - 1) * DAY)
    const dayEnd = new Date(bounds.start.getTime() + day * DAY)
    const dayPurchases = purchases.filter(p => p.createdAt >= dayStart && p.createdAt < dayEnd)
    dailyAgg.push({
      label: `${day} ${monthShort}`,
      dateKey: fmtDateSV(dayStart),
      revenue: round2(dayPurchases.reduce((s, p) => s + p.finalPrice, 0)),
      orders: dayPurchases.length,
      customers: new Set(dayPurchases.map(p => p.userId)).size,
    })
  }

  // ── Resumen semanal ──
  const weeklyAgg: WeeklyAgg[] = weeks.map(w => {
    const wp = purchases.filter(p => p.createdAt >= w.start && p.createdAt < w.end)
    return {
      label: w.label,
      revenue: round2(wp.reduce((s, p) => s + p.finalPrice, 0)),
      orders: wp.length,
      customers: new Set(wp.map(p => p.userId)).size,
    }
  })

  // ── Detalle de paquetes ──
  const pkgMap = new Map<string, { packageName: string; disciplines: string[]; unitsSold: number; totalRevenue: number; unitPrice: number }>()
  for (const p of purchases) {
    const existing = pkgMap.get(p.package.id)
    if (existing) {
      existing.unitsSold++
      existing.totalRevenue += p.finalPrice
    } else {
      pkgMap.set(p.package.id, {
        packageName: p.package.name,
        disciplines: p.package.disciplines.map(d => d.discipline.name),
        unitsSold: 1,
        totalRevenue: p.finalPrice,
        unitPrice: p.package.price,
      })
    }
  }
  const packageDistribution: PkgStat[] = Array.from(pkgMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((pkg, i) => ({
      rank: i + 1,
      ...pkg,
      totalRevenue: round2(pkg.totalRevenue),
      pctTotal: totalGross > 0 ? round2((pkg.totalRevenue / totalGross) * 100) : 0,
    }))

  // ── Top 10 clientes ──
  const custMap = new Map<string, { userName: string; userEmail: string; totalSpent: number; orderCount: number; packages: Set<string> }>()
  for (const p of purchases) {
    const existing = custMap.get(p.userId)
    if (existing) {
      existing.totalSpent += p.finalPrice
      existing.orderCount++
      existing.packages.add(p.package.name)
    } else {
      custMap.set(p.userId, {
        userName: p.user.name || 'Sin nombre',
        userEmail: p.user.email,
        totalSpent: p.finalPrice,
        orderCount: 1,
        packages: new Set([p.package.name]),
      })
    }
  }
  const topCustomers: CustomerStat[] = Array.from(custMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
    .map((c, i) => ({
      rank: i + 1,
      userName: c.userName,
      userEmail: c.userEmail,
      totalSpent: round2(c.totalSpent),
      orderCount: c.orderCount,
      packages: Array.from(c.packages),
      pctTotal: totalGross > 0 ? round2((c.totalSpent / totalGross) * 100) : 0,
    }))

  // ── % Ventas por disciplina ──
  const discRevenueMap = new Map<string, number>()
  for (const d of disciplines) discRevenueMap.set(d.id, 0)
  let unattributedRevenue = 0
  let buyersWithoutReservations = 0
  let buyersWithReservations = 0
  for (const p of purchases) {
    const wMap = userDisciplineWeights.get(p.userId)
    if (!wMap || wMap.size === 0) {
      unattributedRevenue += p.finalPrice
      buyersWithoutReservations++
      continue
    }
    buyersWithReservations++
    const totalW = Array.from(wMap.values()).reduce((s, w) => s + w, 0)
    if (totalW === 0) {
      unattributedRevenue += p.finalPrice
      continue
    }
    for (const [dId, w] of Array.from(wMap.entries())) {
      const share = (w / totalW) * p.finalPrice
      discRevenueMap.set(dId, (discRevenueMap.get(dId) ?? 0) + share)
    }
  }
  const discRevenueRows: DisciplineRevenueRow[] = Array.from(discRevenueMap.entries())
    .map(([id, revenue]) => ({ name: discIdToName.get(id) ?? '(desconocido)', revenue }))
    .filter(r => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // ── Ingresos por método de pago ──
  const methodMap = new Map<string, { revenue: number; orders: number }>()
  for (const p of purchases) {
    const method = classifyPayment(p.paymentProviderId)
    const cur = methodMap.get(method) ?? { revenue: 0, orders: 0 }
    cur.revenue += p.finalPrice
    cur.orders++
    methodMap.set(method, cur)
  }
  const byMethod: PaymentMethodAgg[] = Array.from(methodMap.entries())
    .map(([method, v]) => ({ method, revenue: round2(v.revenue), orders: v.orders }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── Pagos a instructores (desde DB, escala vigente) ──
  const instrResult = await computeInstructorPayments(prisma, bounds.start, bounds.end)
  const instrPayments = new Map<string, InstructorPayByDiscipline>()
  for (const row of instrResult.rows) {
    const cur = instrPayments.get(row.disciplineName) ?? { monto: 0, aPagar: 0, rentaRetenida: 0, clases: 0 }
    cur.monto += row.bruto
    cur.aPagar += row.neto
    cur.rentaRetenida += row.renta
    cur.clases += 1
    instrPayments.set(row.disciplineName, cur)
  }
  const instrTotals = {
    monto: instrResult.totalBruto,
    aPagar: instrResult.totalNeto,
    rentaRetenida: instrResult.totalRenta,
  }

  // ── Ocupación por clase ──
  const classes = await prisma.class.findMany({
    where: {
      dateTime: { gte: bounds.start, lt: bounds.end },
      isCancelled: false,
      isPrivate: false,
    },
    select: {
      dateTime: true,
      maxCapacity: true,
      disciplineId: true,
      classType: true,
      instructor: { select: { name: true } },
      reservations: {
        where: {
          userId: { notIn: EXCLUDED_USER_IDS },
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ATTENDED, ReservationStatus.NO_SHOW] },
        },
        select: { status: true, checkedIn: true },
      },
    },
    orderBy: { dateTime: 'asc' },
  })

  const weekIdxForDate = (dt: Date): number =>
    weeks.find(w => dt >= w.start && dt < w.end)?.idx ?? weeks.length

  const occByDisc = new Map<string, DisciplineOccupancy>()
  for (const c of classes) {
    const att = c.reservations.filter(
      r => r.status === ReservationStatus.ATTENDED || r.checkedIn,
    ).length
    const dName = discIdToName.get(c.disciplineId) ?? '(sin nombre)'
    let db = occByDisc.get(c.disciplineId)
    if (!db) {
      db = { name: dName, weeks: new Map(), capacity: 0, asistieron: 0, classCount: 0 }
      occByDisc.set(c.disciplineId, db)
    }
    const wk = weekIdxForDate(c.dateTime)
    let wb = db.weeks.get(wk)
    if (!wb) {
      wb = { rows: [], capacity: 0, asistieron: 0 }
      db.weeks.set(wk, wb)
    }
    wb.rows.push({
      dateTime: c.dateTime,
      instructor: c.instructor?.name ?? '',
      classType: c.classType ?? '',
      capacity: c.maxCapacity,
      asistieron: att,
    })
    wb.capacity += c.maxCapacity
    wb.asistieron += att
    db.capacity += c.maxCapacity
    db.asistieron += att
    db.classCount++
  }
  const occupancy = Array.from(occByDisc.values()).sort((a, b) => b.asistieron - a.asistieron)
  const totalCapMonth = occupancy.reduce((s, d) => s + d.capacity, 0)
  const totalAttMonth = occupancy.reduce((s, d) => s + d.asistieron, 0)
  const monthOccPct = totalCapMonth > 0 ? round2((totalAttMonth / totalCapMonth) * 100) : 0

  // ── Listado completo ──
  const sales: SaleRow[] = purchases.map(p => ({
    createdAt: p.createdAt,
    userName: p.user.name || 'Sin nombre',
    userEmail: p.user.email,
    packageName: p.package.name,
    originalPrice: round2(p.originalPrice),
    finalPrice: round2(p.finalPrice),
    discountCode: p.discountCode || '',
    method: classifyPayment(p.paymentProviderId),
    status: p.status,
    classesRemaining: p.classesRemaining,
    classCount: p.package.classCount,
    expiresAt: p.expiresAt,
  }))

  return {
    bounds,
    weeks,
    totalGross,
    totalIva,
    totalNet,
    orderCount,
    uniqueCustomers,
    avgTicket,
    monthOccPct,
    dailyAgg,
    weeklyAgg,
    packageDistribution,
    topCustomers,
    discRevenueRows,
    unattributedRevenue: round2(unattributedRevenue),
    buyersWithReservations,
    buyersWithoutReservations,
    byMethod,
    instrPayments,
    instrTotals,
    occupancy,
    sales,
  }
}

export function buildSalesReportExcel(data: SalesReportData): Buffer {
  const {
    bounds, weeks, totalGross, totalIva, totalNet, orderCount, uniqueCustomers,
    avgTicket, monthOccPct, dailyAgg, weeklyAgg, packageDistribution, topCustomers,
    discRevenueRows, unattributedRevenue, buyersWithReservations,
    buyersWithoutReservations, byMethod, instrPayments, instrTotals, occupancy, sales,
  } = data
  const label = bounds.label
  const labelUpper = label.toUpperCase()

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Resumen Ejecutivo ─────────────────────────────────────
  const top3Pkgs = packageDistribution.slice(0, 3)
  const top3Disc = discRevenueRows.slice(0, 3)
  const s1: (string | number)[][] = [
    ['REPORTE DE VENTAS - WELLNEST STUDIO'],
    [`Período: ${label} (America/El_Salvador)`],
    ['Generado:', new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })],
    [],
    ['RESUMEN EJECUTIVO'],
    ['Métrica', 'Valor'],
    ['Ingresos brutos (con IVA)', `$${totalGross.toFixed(2)}`],
    ['IVA cobrado (13%)', `$${totalIva.toFixed(2)}`],
    ['Ingresos netos (sin IVA)', `$${totalNet.toFixed(2)}`],
    ['Total compras pagadas', orderCount],
    ['Clientes únicos', uniqueCustomers],
    ['Ticket promedio', `$${avgTicket.toFixed(2)}`],
    ['Ocupación mensual (asist/capacidad)', `${monthOccPct.toFixed(1)}%`],
    [],
    ['VENTAS POR MÉTODO DE PAGO'],
    ['Método', 'Ingresos', 'Compras', '% del Total'],
    ...byMethod.map(m => [
      m.method,
      `$${m.revenue.toFixed(2)}`,
      m.orders,
      totalGross > 0 ? `${round2((m.revenue / totalGross) * 100)}%` : '0%',
    ]),
    [],
    ['TOP 3 PAQUETES POR INGRESOS'],
    ['Paquete', 'Ingresos', 'Unidades', '% del Total'],
    ...top3Pkgs.map(p => [p.packageName, `$${p.totalRevenue.toFixed(2)}`, p.unitsSold, `${p.pctTotal}%`]),
    [],
    ['TOP 3 DISCIPLINAS POR INGRESOS (atribución por reservas)'],
    ['Disciplina', 'Ingresos', '% del Total'],
    ...top3Disc.map(d => [d.name, `$${round2(d.revenue).toFixed(2)}`, totalGross > 0 ? `${round2((d.revenue / totalGross) * 100)}%` : '0%']),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(s1)
  ws1['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Ejecutivo')

  // ── Sheet 2: Detalle Diario ────────────────────────────────────────
  const s2: (string | number)[][] = [
    [`DETALLE DIARIO - ${labelUpper}`],
    [],
    ['Día', 'Ingresos (USD)', 'Compras', 'Clientes Únicos', 'Ticket Promedio'],
    ...dailyAgg.map(d => [
      d.label,
      d.revenue,
      d.orders,
      d.customers,
      d.orders > 0 ? round2(d.revenue / d.orders) : 0,
    ]),
    [],
    [`TOTAL ${labelUpper}`, round2(totalGross), orderCount, uniqueCustomers, avgTicket],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(s2)
  ws2['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Diario')

  // ── Sheet 3: Resumen Semanal ───────────────────────────────────────
  const s3: (string | number)[][] = [
    [`RESUMEN SEMANAL - ${labelUpper}`],
    ['Semanas Lunes-Domingo en hora SV; la primera y última pueden ser parciales.'],
    [],
    ['Semana', 'Ingresos (USD)', 'Compras', 'Clientes Únicos', 'Ticket Promedio'],
    ...weeklyAgg.map(w => [
      w.label,
      w.revenue,
      w.orders,
      w.customers,
      w.orders > 0 ? round2(w.revenue / w.orders) : 0,
    ]),
    [],
    [`TOTAL ${labelUpper}`, round2(totalGross), orderCount, uniqueCustomers, avgTicket],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(s3)
  ws3['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Resumen Semanal')

  // ── Sheet 4: Detalle Paquetes ──────────────────────────────────────
  const s4: (string | number)[][] = [
    [`DETALLE DE PAQUETES VENDIDOS - ${labelUpper}`],
    [],
    ['#', 'Paquete', 'Disciplina(s)', 'Unidades', 'Ingresos', 'Precio Unit.', '% del Total'],
    ...packageDistribution.map(p => [
      p.rank,
      p.packageName,
      p.disciplines.join(', ') || 'N/A',
      p.unitsSold,
      p.totalRevenue,
      round2(p.unitPrice),
      p.pctTotal / 100,
    ]),
    [],
    ['', 'TOTAL', '', orderCount, round2(totalGross), '', 1],
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(s4)
  ws4['!cols'] = [{ wch: 4 }, { wch: 36 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
  for (let r = 3; r < s4.length; r++) {
    const ref = XLSX.utils.encode_cell({ c: 6, r })
    if (ws4[ref]) ws4[ref].z = '0.0%'
  }
  XLSX.utils.book_append_sheet(wb, ws4, 'Detalle Paquetes')

  // ── Sheet 5: Top 10 Clientes ───────────────────────────────────────
  const s5: (string | number)[][] = [
    [`TOP 10 CLIENTES POR INGRESOS - ${labelUpper}`],
    [],
    ['#', 'Nombre', 'Email', 'Total Gastado', 'Compras', 'Paquetes', '% del Total'],
    ...topCustomers.map(c => [
      c.rank,
      c.userName,
      c.userEmail,
      c.totalSpent,
      c.orderCount,
      c.packages.join(', '),
      c.pctTotal / 100,
    ]),
  ]
  const ws5 = XLSX.utils.aoa_to_sheet(s5)
  ws5['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 34 }, { wch: 14 }, { wch: 10 }, { wch: 42 }, { wch: 12 }]
  for (let r = 3; r < s5.length; r++) {
    const ref = XLSX.utils.encode_cell({ c: 6, r })
    if (ws5[ref]) ws5[ref].z = '0.0%'
  }
  XLSX.utils.book_append_sheet(wb, ws5, 'Top 10 Clientes')

  // ── Sheet 6: % Ventas por Disciplina + Pagos Instructores ──────────
  const blank = ''
  const s6: (string | number)[][] = [
    [`% VENTAS POR DISCIPLINA + PAGOS A INSTRUCTORES - ${labelUpper}`],
    ['Ingresos: atribución proporcional al uso real: para cada compra se reparte'],
    ['finalPrice entre las disciplinas según las reservas activas del comprador'],
    ['en el mes. Reservas con disciplina complementaria cuentan 0.5 en cada una.'],
    ['"Sin uso en el mes" = compras de usuarios sin reservas activas en el mes.'],
    [],
    ['Pagos: calculados desde la base de datos con la escala de pago vigente'],
    ['(11 May 2026), todos los instructores. Excluye clases canceladas, privadas'],
    ['(1:1) y reservas de usuarios de prueba.'],
    ['Renta = 10% retenida de Sujeto Excluido (Monto - A pagar = Renta).'],
    [],
    ['#', 'Disciplina', 'Ingresos Atribuidos', '% del Total', 'Monto Instructor', 'A pagar (neto)', 'Renta retenida (10%)'],
    ...discRevenueRows.map((r, i) => {
      const pay = instrPayments.get(r.name)
      return [
        i + 1,
        r.name,
        round2(r.revenue),
        totalGross > 0 ? r.revenue / totalGross : 0,
        pay ? round2(pay.monto) : blank,
        pay ? round2(pay.aPagar) : blank,
        pay ? round2(pay.rentaRetenida) : blank,
      ]
    }),
    ...(unattributedRevenue > 0
      ? [['', '(Sin uso en el mes)', round2(unattributedRevenue), totalGross > 0 ? unattributedRevenue / totalGross : 0, blank, blank, blank]]
      : []),
    [],
    ['', 'TOTAL', round2(totalGross), 1, round2(instrTotals.monto), round2(instrTotals.aPagar), round2(instrTotals.rentaRetenida)],
    [],
    ['Validación atribución', `${buyersWithReservations} compras con uso, ${buyersWithoutReservations} compras sin uso`],
    ['Disciplinas con pago', Array.from(instrPayments.keys()).join(', ') || '(sin datos)'],
  ]
  const ws6 = XLSX.utils.aoa_to_sheet(s6)
  ws6['!cols'] = [
    { wch: 4 }, { wch: 26 }, { wch: 18 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 20 },
  ]
  for (let r = 12; r < s6.length; r++) {
    const pctRef = XLSX.utils.encode_cell({ c: 3, r })
    if (ws6[pctRef] && typeof ws6[pctRef].v === 'number' && ws6[pctRef].v <= 1) {
      ws6[pctRef].z = '0.0%'
    }
    for (const c of [2, 4, 5, 6]) {
      const ref = XLSX.utils.encode_cell({ c, r })
      if (ws6[ref] && typeof ws6[ref].v === 'number') ws6[ref].z = '"$"#,##0.00'
    }
  }
  XLSX.utils.book_append_sheet(wb, ws6, '% Ventas Disciplina')

  // ── Sheet 7: Ocupación por Clase ───────────────────────────────────
  const s7: (string | number)[][] = [
    [`OCUPACIÓN POR CLASE - ${labelUpper}`],
    ['% Ocupación = Asistieron / Capacidad. Excluye clases canceladas y privadas (1:1).'],
    ['Asistieron = status=ATTENDED OR checkedIn=true.'],
    [],
  ]

  const pivotHeader: (string | number)[] = ['Disciplina', 'Métrica']
  for (const w of weeks) pivotHeader.push(w.label)
  pivotHeader.push(`Total ${label}`)
  s7.push(['RESUMEN: % OCUPACIÓN POR DISCIPLINA Y SEMANA'])
  s7.push(pivotHeader)

  const pctCells: { r: number; c: number }[] = []
  const lastPivotCol = weeks.length + 1

  for (const db of occupancy) {
    const capRow: (string | number)[] = [db.name, 'Capacidad']
    const attRow: (string | number)[] = ['', 'Asistieron']
    const pctRow: (string | number)[] = ['', '% Ocupación']
    let totalCap = 0
    let totalAtt = 0
    for (const w of weeks) {
      const wkb = db.weeks.get(w.idx)
      const cap = wkb?.capacity ?? 0
      const att = wkb?.asistieron ?? 0
      capRow.push(cap)
      attRow.push(att)
      pctRow.push(cap > 0 ? att / cap : 0)
      totalCap += cap
      totalAtt += att
    }
    capRow.push(totalCap)
    attRow.push(totalAtt)
    pctRow.push(totalCap > 0 ? totalAtt / totalCap : 0)
    s7.push(capRow)
    s7.push(attRow)
    const pctRowIdx = s7.length
    s7.push(pctRow)
    for (let c = 2; c <= lastPivotCol + 1; c++) pctCells.push({ r: pctRowIdx, c })
  }

  const totalCapRow: (string | number)[] = ['TOTAL MES', 'Capacidad']
  const totalAttRow: (string | number)[] = ['', 'Asistieron']
  const totalPctRow: (string | number)[] = ['', '% Ocupación']
  let grandCap = 0
  let grandAtt = 0
  for (const w of weeks) {
    let wkCap = 0
    let wkAtt = 0
    for (const db of occupancy) {
      const wkb = db.weeks.get(w.idx)
      if (wkb) {
        wkCap += wkb.capacity
        wkAtt += wkb.asistieron
      }
    }
    totalCapRow.push(wkCap)
    totalAttRow.push(wkAtt)
    totalPctRow.push(wkCap > 0 ? wkAtt / wkCap : 0)
    grandCap += wkCap
    grandAtt += wkAtt
  }
  totalCapRow.push(grandCap)
  totalAttRow.push(grandAtt)
  totalPctRow.push(grandCap > 0 ? grandAtt / grandCap : 0)
  s7.push(totalCapRow)
  s7.push(totalAttRow)
  const grandPctRowIdx = s7.length
  s7.push(totalPctRow)
  for (let c = 2; c <= lastPivotCol + 1; c++) pctCells.push({ r: grandPctRowIdx, c })

  s7.push([])
  s7.push(['DETALLE: CLASES POR DISCIPLINA Y SEMANA'])
  s7.push([])

  for (const db of occupancy) {
    s7.push([`▸ ${db.name}`])
    s7.push(['Fecha', 'Hora', 'Instructor', 'Tipo', 'Capacidad', 'Asistieron', '% Ocupación'])
    for (const w of weeks) {
      const wkb = db.weeks.get(w.idx)
      if (!wkb || wkb.rows.length === 0) continue
      s7.push([w.label])
      const sortedRows = [...wkb.rows].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
      for (const r of sortedRows) {
        const rowIdx = s7.length
        s7.push([
          fmtDateShort(r.dateTime),
          fmtTimeAmPm(r.dateTime),
          r.instructor,
          r.classType,
          r.capacity,
          r.asistieron,
          r.capacity > 0 ? r.asistieron / r.capacity : 0,
        ])
        pctCells.push({ r: rowIdx, c: 6 })
      }
      const subRowIdx = s7.length
      s7.push([
        '',
        '',
        '',
        `Subtotal ${w.label}`,
        wkb.capacity,
        wkb.asistieron,
        wkb.capacity > 0 ? wkb.asistieron / wkb.capacity : 0,
      ])
      pctCells.push({ r: subRowIdx, c: 6 })
    }
    const totRowIdx = s7.length
    s7.push([
      '',
      '',
      '',
      `TOTAL ${labelUpper} — ${db.name}`,
      db.capacity,
      db.asistieron,
      db.capacity > 0 ? db.asistieron / db.capacity : 0,
    ])
    pctCells.push({ r: totRowIdx, c: 6 })
    s7.push([])
  }

  const ws7 = XLSX.utils.aoa_to_sheet(s7)
  ws7['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  for (const { r, c } of pctCells) {
    const ref = XLSX.utils.encode_cell({ c, r })
    if (ws7[ref]) ws7[ref].z = '0.0%'
  }
  XLSX.utils.book_append_sheet(wb, ws7, 'Ocupación por Clase')

  // ── Sheet 8: Listado Completo de Ventas ────────────────────────────
  const s8: (string | number)[][] = [
    [`LISTADO COMPLETO DE VENTAS - ${labelUpper}`],
    [`Total: ${orderCount} compras pagadas | $${totalGross.toFixed(2)} bruto`],
    [],
    ['#', 'Fecha', 'Hora', 'Cliente', 'Email', 'Paquete', 'Precio Original', 'Precio Final', 'Descuento', 'Método', 'Estado', 'Clases', 'Vencimiento'],
    ...sales.map((p, i) => [
      i + 1,
      fmtDateSV(p.createdAt),
      fmtTimeSV(p.createdAt),
      p.userName,
      p.userEmail,
      p.packageName,
      p.originalPrice,
      p.finalPrice,
      p.discountCode,
      p.method,
      p.status,
      `${p.classesRemaining}/${p.classCount}`,
      fmtDateSV(p.expiresAt),
    ]),
    [],
    ['', '', '', '', '', 'TOTAL', '', round2(totalGross), '', '', '', '', ''],
  ]
  const ws8 = XLSX.utils.aoa_to_sheet(s8)
  ws8['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 32 },
    { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws8, 'Listado Ventas')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return buf as Buffer
}

export function buildSalesEmailHtml(data: SalesReportData): string {
  const metricRows = [
    ['Ingresos brutos (con IVA)', `$${data.totalGross.toFixed(2)}`],
    ['IVA cobrado (13%)', `$${data.totalIva.toFixed(2)}`],
    ['Ingresos netos (sin IVA)', `$${data.totalNet.toFixed(2)}`],
    ['Total compras pagadas', String(data.orderCount)],
    ['Clientes únicos', String(data.uniqueCustomers)],
    ['Ticket promedio', `$${data.avgTicket.toFixed(2)}`],
    ['Ocupación mensual (asist/capacidad)', `${data.monthOccPct.toFixed(1)}%`],
  ]
    .map(([label, value]) => `<p style="margin:4px 0;font-size:13px;color:#374151;"><strong>${label}:</strong> ${value}</p>`)
    .join('')
  const methodRows = data.byMethod
    .map(m => `<li style="margin:2px 0;font-size:13px;color:#374151;">${m.method} — $${m.revenue.toFixed(2)} (${m.orders} compras)</li>`)
    .join('')
  const pkgRows = data.packageDistribution.slice(0, 3)
    .map(p => `<li style="margin:2px 0;font-size:13px;color:#374151;">${p.packageName} — $${p.totalRevenue.toFixed(2)} (${p.unitsSold} u., ${p.pctTotal}%)</li>`)
    .join('')
  const discRows = data.discRevenueRows.slice(0, 3)
    .map(d => {
      const pct = data.totalGross > 0 ? round2((d.revenue / data.totalGross) * 100) : 0
      return `<li style="margin:2px 0;font-size:13px;color:#374151;">${d.name} — $${round2(d.revenue).toFixed(2)} (${pct}%)</li>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Reporte de Ventas — ${data.bounds.label}</title></head>
<body style="margin:0;padding:0;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0EB;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;">
        <tr><td style="padding:32px;">
          <h1 style="color:#1F2937;margin:0 0 8px;font-size:20px;font-weight:600;">Reporte mensual de ventas</h1>
          <p style="color:#6B7280;margin:0 0 24px;font-size:14px;">Wellnest Studio · ${data.bounds.label} (hora El Salvador)</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;">
              ${metricRows}
            </td></tr>
          </table>
          <p style="margin:16px 0 4px;font-size:13px;color:#1F2937;font-weight:600;">Ingresos por método de pago</p>
          <ul style="margin:0 0 12px;padding-left:18px;">${methodRows}</ul>
          <p style="margin:12px 0 4px;font-size:13px;color:#1F2937;font-weight:600;">Top paquetes por ingresos</p>
          <ul style="margin:0 0 12px;padding-left:18px;">${pkgRows}</ul>
          <p style="margin:12px 0 4px;font-size:13px;color:#1F2937;font-weight:600;">Top disciplinas por ingresos</p>
          <ul style="margin:0 0 12px;padding-left:18px;">${discRows}</ul>
          <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:16px 0 0;">Reporte del mes cerrado de ${data.bounds.label.toLowerCase()}, hora El Salvador. El detalle completo (diario, semanal, paquetes, top clientes, % por disciplina con pagos a instructores, ocupación por clase y listado de ventas) va en el Excel adjunto.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function salesReportFilename(label: string): string {
  return `REPORTE_VENTAS_${label.toUpperCase().replace(/\s+/g, '_')}.xlsx`
}
