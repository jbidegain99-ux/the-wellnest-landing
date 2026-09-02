import { describe, it, expect } from 'vitest'
import {
  applyAttendanceOverrides,
  calculatePayTier,
  type ClassPaymentRow,
  type InstructorPaymentsResult,
} from './instructorPayments'

function row(over: Partial<ClassPaymentRow> & { classId: string; instructorId: string; attendees: number; capacity: number }): ClassPaymentRow {
  const tier = calculatePayTier(over.capacity, over.attendees)
  return {
    dateTime: new Date('2026-08-13T22:00:00Z'),
    disciplineName: 'Yoga',
    classType: '',
    instructorName: over.instructorId,
    attendeesFromReservations: over.attendees,
    table: over.capacity <= 6 ? '6' : '10',
    tierLabel: tier.label,
    bruto: tier.bruto,
    neto: tier.neto,
    renta: tier.renta,
    ...over,
  }
}

function result(rows: ClassPaymentRow[]): InstructorPaymentsResult {
  const byInstructor = new Map<string, ClassPaymentRow[]>()
  for (const r of rows) byInstructor.set(r.instructorId, [...(byInstructor.get(r.instructorId) ?? []), r])
  return {
    periodStart: new Date('2026-08-01T06:00:00Z'),
    periodEnd: new Date('2026-09-01T06:00:00Z'),
    rows,
    summaryByInstructor: Array.from(byInstructor.entries()).map(([id, rs]) => ({
      instructorId: id,
      instructorName: id,
      classes: rs.length,
      totalBruto: rs.reduce((s, r) => s + r.bruto, 0),
      totalNeto: rs.reduce((s, r) => s + r.neto, 0),
      totalRenta: rs.reduce((s, r) => s + r.renta, 0),
      byDiscipline: new Map(),
    })),
    totalBruto: rs2(rows, 'bruto'),
    totalNeto: rs2(rows, 'neto'),
    totalRenta: rs2(rows, 'renta'),
    classesCounted: rows.length,
  }
}
function rs2(rows: ClassPaymentRow[], k: 'bruto' | 'neto' | 'renta'): number {
  return Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100
}

describe('applyAttendanceOverrides', () => {
  const base = result([
    row({ classId: 'c1', instructorId: 'ana', capacity: 6, attendees: 3 }),   // $13.33
    row({ classId: 'c2', instructorId: 'ana', capacity: 6, attendees: 2 }),   // $12.00
    row({ classId: 'c3', instructorId: 'beto', capacity: 10, attendees: 8 }), // $15.00
  ])

  it('sin overrides devuelve el mismo resultado', () => {
    expect(applyAttendanceOverrides(base, [])).toBe(base)
  })

  it('recalcula tramo, resumen y totales de la clase corregida', () => {
    const out = applyAttendanceOverrides(base, [{ classId: 'c1', attendees: 5, note: '2 extra sin registrar' }])
    const c1 = out.rows.find(r => r.classId === 'c1')!
    expect(c1.attendees).toBe(5)
    expect(c1.bruto).toBe(15.00)
    expect(c1.tierLabel).toBe('5 alumnos')
    expect(c1.adjustmentReason).toBe('2 extra sin registrar')
    // conserva el conteo original del sistema para auditoría
    expect(c1.attendeesFromReservations).toBe(3)
    // el resumen de Ana sube $1.67 bruto; Beto no se toca
    const ana = out.summaryByInstructor.find(s => s.instructorId === 'ana')!
    expect(ana.totalBruto).toBe(27.00) // 15.00 + 12.00
    expect(out.totalBruto).toBe(42.00) // + 15.00 de Beto
  })

  it('lanza si un ajuste no corresponde a ninguna clase del período', () => {
    expect(() => applyAttendanceOverrides(base, [{ classId: 'no-existe', attendees: 4, note: 'x' }]))
      .toThrow(/no corresponden a ninguna clase/)
  })

  it('es idempotente: re-aplicar el mismo valor no cambia totales', () => {
    const once = applyAttendanceOverrides(base, [{ classId: 'c1', attendees: 5, note: 'n' }])
    const twice = applyAttendanceOverrides(once, [{ classId: 'c1', attendees: 5, note: 'n' }])
    expect(twice.totalNeto).toBe(once.totalNeto)
    expect(twice.totalBruto).toBe(once.totalBruto)
  })

  it('la agregación del override coincide con la del cálculo original', () => {
    // Override que no cambia nada debe reproducir exactamente los totales base
    const same = applyAttendanceOverrides(base, base.rows.map(r => ({ classId: r.classId, attendees: r.attendees, note: 'igual' })))
    expect(same.totalBruto).toBe(base.totalBruto)
    expect(same.totalNeto).toBe(base.totalNeto)
    expect(same.totalRenta).toBe(base.totalRenta)
    expect(same.classesCounted).toBe(base.classesCounted)
  })
})
