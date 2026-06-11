/**
 * Cálculo de pago a instructores según escala "Nueva escala de pago — 11 May 2026".
 *
 * Reglas:
 *   Disciplinas capacidad 6 (Pole Dance · Aro · Telas):
 *     1-2 alumnos (17-33%)   → bruto $12.00 / neto $10.80
 *     3-4 alumnos (50-67%)   → bruto $13.33 / neto $12.00
 *     5 alumnos   (83%)      → bruto $15.00 / neto $13.50
 *     6 alumnos   (100%)     → bruto $16.67 / neto $15.00
 *
 *   Disciplinas capacidad 10 (Mat Pilates · Yoga · Terapia de Sonido):
 *     1-4 alumnos (10-40%)   → bruto $12.00 / neto $10.80
 *     5-7 alumnos (50-70%)   → bruto $13.33 / neto $12.00
 *     8 alumnos   (80%)      → bruto $15.00 / neto $13.50
 *     9-10 alumnos (90-100%) → bruto $16.67 / neto $15.00
 *
 *   Renta retenida = 10% del bruto = (bruto - neto).
 *
 * El tramo se determina por la capacidad real de la clase (Class.maxCapacity):
 *   maxCapacity ≤ 6  → tabla de 6
 *   maxCapacity ≥ 7  → tabla de 10
 *
 * Excluye clases canceladas, privadas (1:1) y reservas de usuarios de prueba.
 */

import type { PrismaClient } from '@prisma/client'
import { ReservationStatus } from '@prisma/client'
import * as XLSX from 'xlsx'
// Una sola fuente de verdad: una copia local desincronizada afecta
// directamente los pagos a instructores
import { EXCLUDED_USER_IDS } from '@/lib/constants'

export interface PayTier {
  bruto: number
  neto: number
  renta: number
  label: string
}

export interface ClassPaymentRow {
  classId: string
  dateTime: Date
  disciplineName: string
  classType: string
  instructorId: string
  instructorName: string
  capacity: number
  attendees: number
  table: '6' | '10' | 'otro'
  tierLabel: string
  bruto: number
  neto: number
  renta: number
}

export interface InstructorSummaryRow {
  instructorId: string
  instructorName: string
  classes: number
  totalBruto: number
  totalNeto: number
  totalRenta: number
  byDiscipline: Map<string, { classes: number; bruto: number; neto: number; renta: number }>
}

export interface InstructorPaymentsResult {
  periodStart: Date
  periodEnd: Date
  rows: ClassPaymentRow[]
  summaryByInstructor: InstructorSummaryRow[]
  totalBruto: number
  totalNeto: number
  totalRenta: number
  classesCounted: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculatePayTier(maxCapacity: number, attendees: number): PayTier {
  if (attendees <= 0) {
    return { bruto: 0, neto: 0, renta: 0, label: 'Sin asistentes' }
  }

  if (maxCapacity <= 6) {
    if (attendees <= 2) return { bruto: 12.00, neto: 10.80, renta: 1.20, label: '1-2 alumnos' }
    if (attendees <= 4) return { bruto: 13.33, neto: 12.00, renta: 1.33, label: '3-4 alumnos' }
    if (attendees === 5) return { bruto: 15.00, neto: 13.50, renta: 1.50, label: '5 alumnos' }
    return { bruto: 16.67, neto: 15.00, renta: 1.67, label: '6+ alumnos (lleno)' }
  }

  if (attendees <= 4) return { bruto: 12.00, neto: 10.80, renta: 1.20, label: '1-4 alumnos' }
  if (attendees <= 7) return { bruto: 13.33, neto: 12.00, renta: 1.33, label: '5-7 alumnos' }
  if (attendees === 8) return { bruto: 15.00, neto: 13.50, renta: 1.50, label: '8 alumnos' }
  return { bruto: 16.67, neto: 15.00, renta: 1.67, label: '9+ alumnos (lleno)' }
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
  let h = sv.getUTCHours()
  const m = sv.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDateShort(d: Date): string {
  const sv = svLocal(d)
  return `${String(sv.getUTCDate()).padStart(2, '0')}/${String(sv.getUTCMonth() + 1).padStart(2, '0')}`
}

const fmtTimeAmPm = fmtTimeSV

/**
 * Computes the previous full Monday→Sunday week in SV time, returned as UTC bounds.
 * Week starts Monday 00:00 SV; ends the following Monday 00:00 SV (exclusive).
 * Example: called Monday 2026-05-11 → [Mon 2026-05-04 00:00 SV, Mon 2026-05-11 00:00 SV).
 */
export function previousWeekBoundsSV(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const nowSV = svLocal(now)
  // SV day-of-week: 0=Sun, 1=Mon, ..., 6=Sat
  const dow = nowSV.getUTCDay()
  // Days to subtract to get to "this week's Monday" (in SV).
  // If today is Monday (dow=1), this week's Monday is today.
  // If Sunday (dow=0), this week's Monday is 6 days ago.
  const daysToThisMonday = dow === 0 ? 6 : dow - 1
  const thisMondaySVMidnightUTC = Date.UTC(
    nowSV.getUTCFullYear(),
    nowSV.getUTCMonth(),
    nowSV.getUTCDate() - daysToThisMonday,
    6, 0, 0, 0, // SV midnight = 06:00 UTC
  )
  const start = new Date(thisMondaySVMidnightUTC - 7 * 24 * 3600 * 1000)
  const end = new Date(thisMondaySVMidnightUTC)
  return { start, end, label: formatWeekLabel(start, end) }
}

/**
 * Builds a week bounds object from an explicit Monday date (YYYY-MM-DD in SV).
 * Throws if the date is not a Monday.
 */
export function weekBoundsFromMondaySV(mondayYmd: string): { start: Date; end: Date; label: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(mondayYmd)
  if (!m) throw new Error('weekStart must be YYYY-MM-DD')
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const start = new Date(Date.UTC(y, mo, d, 6, 0, 0, 0))
  // Validate it's actually a Monday in SV time
  if (svLocal(start).getUTCDay() !== 1) {
    throw new Error(`weekStart ${mondayYmd} is not a Monday in El Salvador time`)
  }
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000)
  return { start, end, label: formatWeekLabel(start, end) }
}

function formatWeekLabel(start: Date, end: Date): string {
  const sStart = svLocal(start)
  const sEndInclusive = new Date(end.getTime() - 24 * 3600 * 1000) // Sunday of the week
  const sEnd = svLocal(sEndInclusive)
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const ds = sStart.getUTCDate()
  const ms = months[sStart.getUTCMonth()]
  const de = sEnd.getUTCDate()
  const me = months[sEnd.getUTCMonth()]
  const ys = sStart.getUTCFullYear()
  if (sStart.getUTCMonth() === sEnd.getUTCMonth()) {
    return `${ds}-${de} ${ms} ${ys}`
  }
  return `${ds} ${ms} - ${de} ${me} ${ys}`
}

export async function computeInstructorPayments(
  prisma: PrismaClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<InstructorPaymentsResult> {
  const classes = await prisma.class.findMany({
    where: {
      dateTime: { gte: periodStart, lt: periodEnd, lte: new Date() },
      isCancelled: false,
      isPrivate: false,
    },
    select: {
      id: true,
      dateTime: true,
      maxCapacity: true,
      classType: true,
      discipline: { select: { name: true } },
      instructor: { select: { id: true, name: true } },
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

  const rows: ClassPaymentRow[] = []
  const summaryMap = new Map<string, InstructorSummaryRow>()

  for (const c of classes) {
    if (!c.instructor) continue
    const attendees = c.reservations.filter(
      r => r.status === ReservationStatus.ATTENDED || r.checkedIn,
    ).length
    const tier = calculatePayTier(c.maxCapacity, attendees)
    const table: '6' | '10' | 'otro' = c.maxCapacity <= 6 ? '6' : c.maxCapacity >= 7 ? '10' : 'otro'
    const disciplineName = c.discipline?.name ?? '(sin disciplina)'

    rows.push({
      classId: c.id,
      dateTime: c.dateTime,
      disciplineName,
      classType: c.classType ?? '',
      instructorId: c.instructor.id,
      instructorName: c.instructor.name,
      capacity: c.maxCapacity,
      attendees,
      table,
      tierLabel: tier.label,
      bruto: tier.bruto,
      neto: tier.neto,
      renta: tier.renta,
    })

    let summary = summaryMap.get(c.instructor.id)
    if (!summary) {
      summary = {
        instructorId: c.instructor.id,
        instructorName: c.instructor.name,
        classes: 0,
        totalBruto: 0,
        totalNeto: 0,
        totalRenta: 0,
        byDiscipline: new Map(),
      }
      summaryMap.set(c.instructor.id, summary)
    }
    summary.classes += 1
    summary.totalBruto += tier.bruto
    summary.totalNeto += tier.neto
    summary.totalRenta += tier.renta

    const discAgg = summary.byDiscipline.get(disciplineName) ?? { classes: 0, bruto: 0, neto: 0, renta: 0 }
    discAgg.classes += 1
    discAgg.bruto += tier.bruto
    discAgg.neto += tier.neto
    discAgg.renta += tier.renta
    summary.byDiscipline.set(disciplineName, discAgg)
  }

  const summaryByInstructor = Array.from(summaryMap.values())
    .map(s => ({
      ...s,
      totalBruto: round2(s.totalBruto),
      totalNeto: round2(s.totalNeto),
      totalRenta: round2(s.totalRenta),
    }))
    .sort((a, b) => b.totalNeto - a.totalNeto)

  const totalBruto = round2(rows.reduce((s, r) => s + r.bruto, 0))
  const totalNeto = round2(rows.reduce((s, r) => s + r.neto, 0))
  const totalRenta = round2(rows.reduce((s, r) => s + r.renta, 0))

  return {
    periodStart,
    periodEnd,
    rows,
    summaryByInstructor,
    totalBruto,
    totalNeto,
    totalRenta,
    classesCounted: rows.length,
  }
}

export function buildInstructorPaymentsExcel(result: InstructorPaymentsResult, periodLabel: string): Buffer {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Resumen por Instructor
  const s1: (string | number)[][] = [
    ['REPORTE DE PAGO A INSTRUCTORES'],
    [`Período: ${periodLabel}`],
    [`Generado: ${new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}`],
    [],
    ['Total clases pagadas', result.classesCounted],
    ['Total Bruto', result.totalBruto],
    ['Total Neto (a pagar)', result.totalNeto],
    ['Total Renta retenida (10%)', result.totalRenta],
    [],
    ['#', 'Instructor', 'Clases', 'Bruto', 'Neto (a pagar)', 'Renta retenida (10%)'],
    ...result.summaryByInstructor.map((s, i) => [
      i + 1,
      s.instructorName,
      s.classes,
      s.totalBruto,
      s.totalNeto,
      s.totalRenta,
    ]),
    [],
    ['', 'TOTAL', result.classesCounted, result.totalBruto, result.totalNeto, result.totalRenta],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(s1)
  ws1['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 22 }]
  for (let r = 9; r < s1.length; r++) {
    for (const c of [3, 4, 5]) {
      const ref = XLSX.utils.encode_cell({ c, r })
      if (ws1[ref] && typeof ws1[ref].v === 'number') ws1[ref].z = '"$"#,##0.00'
    }
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Instructores')

  // Sheet 2: Detalle por Instructor (un bloque por instructor con todas sus clases)
  const s2: (string | number)[][] = [
    ['DETALLE POR INSTRUCTOR'],
    [`Período: ${periodLabel}`],
    [],
  ]

  // Track formatting cells: percentage (col 6) and currency (cols 7, 8, 9)
  const s2PctCells: { r: number; c: number }[] = []
  const s2CurrencyCells: { r: number; c: number }[] = []

  // Group classes per instructor, sorted by discipline (by class count desc) then by dateTime asc
  const rowsByInstructor = new Map<string, ClassPaymentRow[]>()
  for (const row of result.rows) {
    const arr = rowsByInstructor.get(row.instructorId) ?? []
    arr.push(row)
    rowsByInstructor.set(row.instructorId, arr)
  }

  for (const summary of result.summaryByInstructor) {
    const classes = rowsByInstructor.get(summary.instructorId) ?? []
    // Order disciplines by class count desc (matches the image where Pole comes before Aro)
    const disciplineOrder = Array.from(summary.byDiscipline.entries())
      .sort((a, b) => b[1].classes - a[1].classes)
      .map(([name]) => name)
    const discRank = new Map(disciplineOrder.map((name, i) => [name, i]))
    classes.sort((a, b) => {
      const ra = discRank.get(a.disciplineName) ?? 99
      const rb = discRank.get(b.disciplineName) ?? 99
      if (ra !== rb) return ra - rb
      return a.dateTime.getTime() - b.dateTime.getTime()
    })

    // Instructor header
    s2.push([`▸ ${summary.instructorName}`, '', '', '', '', '', '', '', '', `${summary.classes} clases`])
    // Column headers
    s2.push(['Fecha', 'Hora', 'Instructor', 'Disciplina', 'Capacidad', 'Asistencia', '% Ocupación', 'Pago Bruto', '10% Retención', 'Pago Neto'])

    for (const r of classes) {
      const pct = r.capacity > 0 ? r.attendees / r.capacity : 0
      const rowIdx = s2.length
      s2.push([
        fmtDateShort(r.dateTime),
        fmtTimeAmPm(r.dateTime),
        r.instructorName,
        r.disciplineName,
        r.capacity,
        r.attendees,
        pct,
        r.bruto,
        r.renta,
        r.neto,
      ])
      s2PctCells.push({ r: rowIdx, c: 6 })
      s2CurrencyCells.push({ r: rowIdx, c: 7 }, { r: rowIdx, c: 8 }, { r: rowIdx, c: 9 })
    }

    // Subtotal row
    const subRowIdx = s2.length
    s2.push(['', '', '', '', '', '', `Total ${summary.instructorName}`, summary.totalBruto, summary.totalRenta, summary.totalNeto])
    s2CurrencyCells.push({ r: subRowIdx, c: 7 }, { r: subRowIdx, c: 8 }, { r: subRowIdx, c: 9 })
    s2.push([])
  }

  // Grand total
  const grandIdx = s2.length
  s2.push(['', '', '', '', '', '', 'TOTAL GENERAL', result.totalBruto, result.totalRenta, result.totalNeto])
  s2CurrencyCells.push({ r: grandIdx, c: 7 }, { r: grandIdx, c: 8 }, { r: grandIdx, c: 9 })

  const ws2 = XLSX.utils.aoa_to_sheet(s2)
  ws2['!cols'] = [
    { wch: 8 },   // Fecha
    { wch: 10 },  // Hora
    { wch: 24 },  // Instructor
    { wch: 22 },  // Disciplina
    { wch: 10 },  // Capacidad
    { wch: 11 },  // Asistencia
    { wch: 13 },  // % Ocupación
    { wch: 12 },  // Pago Bruto
    { wch: 14 },  // 10% Retención
    { wch: 12 },  // Pago Neto
  ]
  for (const { r, c } of s2PctCells) {
    const ref = XLSX.utils.encode_cell({ c, r })
    if (ws2[ref]) ws2[ref].z = '0.0%'
  }
  for (const { r, c } of s2CurrencyCells) {
    const ref = XLSX.utils.encode_cell({ c, r })
    if (ws2[ref] && typeof ws2[ref].v === 'number') ws2[ref].z = '"$"#,##0.00'
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por Instructor')

  // Sheet 3: Detalle por Clase
  const s3: (string | number)[][] = [
    ['DETALLE POR CLASE'],
    [`Período: ${periodLabel}`],
    [`Reglas: Capacidad ≤ 6 → tabla de 6 alumnos. Capacidad ≥ 7 → tabla de 10 alumnos.`],
    [`Asistentes = status=ATTENDED OR checkedIn=true (excluyendo usuarios de prueba).`],
    [],
    ['#', 'Fecha', 'Hora', 'Instructor', 'Disciplina', 'Tipo', 'Cap.', 'Asist.', 'Tabla', 'Tramo', 'Bruto', 'Neto', 'Renta'],
    ...result.rows.map((r, i) => [
      i + 1,
      fmtDateSV(r.dateTime),
      fmtTimeSV(r.dateTime),
      r.instructorName,
      r.disciplineName,
      r.classType,
      r.capacity,
      r.attendees,
      r.table === 'otro' ? `${r.capacity}` : `cap ${r.table}`,
      r.tierLabel,
      r.bruto,
      r.neto,
      r.renta,
    ]),
    [],
    ['', '', '', '', '', '', '', '', '', 'TOTAL', result.totalBruto, result.totalNeto, result.totalRenta],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(s3)
  ws3['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 10 }, { wch: 26 }, { wch: 22 },
    { wch: 24 }, { wch: 6 }, { wch: 7 }, { wch: 10 }, { wch: 22 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
  ]
  for (let r = 6; r < s3.length; r++) {
    for (const c of [10, 11, 12]) {
      const ref = XLSX.utils.encode_cell({ c, r })
      if (ws3[ref] && typeof ws3[ref].v === 'number') ws3[ref].z = '"$"#,##0.00'
    }
  }
  XLSX.utils.book_append_sheet(wb, ws3, 'Detalle por Clase')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return buf as Buffer
}
