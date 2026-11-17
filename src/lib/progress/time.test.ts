import { describe, it, expect } from 'vitest'
import { localParts, weekIndex, monthIndex, MONTH_LABELS, MONTH_NAMES, TZ } from './time'

describe('time helpers', () => {
  it('usa la zona de El Salvador', () => {
    expect(TZ).toBe('America/El_Salvador')
  })

  it('domingo 25-oct 23:30 SV a partir de UTC del lunes', () => {
    const p = localParts(new Date('2026-10-26T05:30:00Z'))
    expect(p.year).toBe(2026)
    expect(p.month).toBe(9)
    expect(p.isoWeekday).toBe(7)
    expect(p.hour).toBe(23)
    expect(p.day).toBe(Math.round(Date.UTC(2026, 9, 25) / 86400000))
  })

  it('el domingo cae en la semana del lunes anterior', () => {
    const sunday = weekIndex(localParts(new Date('2026-10-26T05:30:00Z')).day)
    const monday = weekIndex(localParts(new Date('2026-10-19T12:00:00Z')).day)
    const nextMonday = weekIndex(localParts(new Date('2026-10-26T12:00:00Z')).day)
    expect(sunday).toBe(monday)
    expect(sunday).not.toBe(nextMonday)
    expect(nextMonday).toBe(monday + 1)
  })

  it('31-oct 23:59 SV sigue en octubre', () => {
    const p = localParts(new Date('2026-11-01T05:59:00Z'))
    expect(p.month).toBe(9)
    expect(p.isoWeekday).toBe(6)
  })

  it('monthIndex = year*12+month', () => {
    expect(monthIndex({ year: 2026, month: 9 })).toBe(2026 * 12 + 9)
  })

  it('nombres de meses', () => {
    expect(MONTH_LABELS).toHaveLength(12)
    expect(MONTH_LABELS[9]).toBe('oct')
    expect(MONTH_NAMES).toHaveLength(12)
    expect(MONTH_NAMES[0]).toBe('enero')
    expect(MONTH_NAMES[9]).toBe('octubre')
    expect(MONTH_NAMES[11]).toBe('diciembre')
  })
})
