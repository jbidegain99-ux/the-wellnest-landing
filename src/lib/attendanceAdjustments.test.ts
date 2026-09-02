import { describe, it, expect } from 'vitest'
import {
  ATTENDANCE_ADJUSTMENTS,
  getAttendanceAdjustment,
  resolveAttendees,
} from './attendanceAdjustments'
import { calculatePayTier } from './instructorPayments'

describe('attendanceAdjustments', () => {
  it('devuelve el conteo del sistema cuando la clase no tiene corrección', () => {
    expect(resolveAttendees('clase-sin-correccion', 3)).toBe(3)
    expect(getAttendanceAdjustment('clase-sin-correccion')).toBeUndefined()
  })

  it('usa el total reportado, no un delta, para que un check-in tardío no duplique', () => {
    const adj = ATTENDANCE_ADJUSTMENTS[0]
    // El sistema tenía 3 al registrar la corrección; si luego alguien hace el
    // check-in que faltaba y sube a 4, el total sigue siendo 4 y no 5.
    expect(resolveAttendees(adj.classId, adj.attendeesInSystemAtRecord)).toBe(adj.attendeesReported)
    expect(resolveAttendees(adj.classId, adj.attendeesReported)).toBe(adj.attendeesReported)
  })

  it('no tiene classIds duplicados', () => {
    const ids = ATTENDANCE_ADJUSTMENTS.map(a => a.classId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada corrección tiene rastro de auditoría completo', () => {
    for (const a of ATTENDANCE_ADJUSTMENTS) {
      expect(a.attendeesReported).toBeGreaterThan(0)
      expect(a.reason.length).toBeGreaterThan(10)
      expect(a.reportedBy).not.toBe('')
      expect(a.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('correcciones de agosto 2026: solo Telas del 28 cambia de tramo', () => {
    // Valeria 13 ago — Yoga cap 10: 3 y 4 caen en el mismo tramo 1-4
    expect(calculatePayTier(10, 3).bruto).toBe(calculatePayTier(10, 4).bruto)
    // Valeria 17 ago — Yoga cap 10: idem
    // Adriana 28 ago — Terapia de Sonido cap 6: 3 y 4 caen en el tramo 3-4
    expect(calculatePayTier(6, 3).bruto).toBe(calculatePayTier(6, 4).bruto)
    // Eugenia 28 ago — Telas cap 5: 3 (tramo 3-4) → 5 (tramo 5) sube el pago
    expect(calculatePayTier(5, 3).bruto).toBe(13.33)
    expect(calculatePayTier(5, 5).bruto).toBe(15.00)
  })
})
