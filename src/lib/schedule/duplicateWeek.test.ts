import { describe, it, expect } from 'vitest'
import {
  allInOneWeek,
  buildDuplicateEntries,
  detectBatchConflicts,
  getMondayOfWeek,
  type DuplicateSource,
} from './duplicateWeek'

const src = (id: string, dateStr: string, time = '07:00', instructorId = 'i1'): DuplicateSource => ({
  id,
  dateStr,
  time,
  discipline: 'Yoga',
  complementaryDiscipline: null,
  instructorId,
  duration: 60,
  maxCapacity: 15,
})

describe('getMondayOfWeek', () => {
  it('lunes devuelve el mismo día', () => {
    expect(getMondayOfWeek('2026-09-14')).toBe('2026-09-14')
  })
  it('domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(getMondayOfWeek('2026-09-20')).toBe('2026-09-14')
  })
  it('cruza mes y año', () => {
    expect(getMondayOfWeek('2027-01-01')).toBe('2026-12-28')
  })
})

describe('allInOneWeek', () => {
  it('lunes a domingo es una semana', () => {
    expect(allInOneWeek(['2026-09-14', '2026-09-17', '2026-09-20'])).toBe(true)
  })
  it('domingo y el lunes siguiente son semanas distintas', () => {
    expect(allInOneWeek(['2026-09-20', '2026-09-21'])).toBe(false)
  })
  it('vacío no viola la regla', () => {
    expect(allInOneWeek([])).toBe(true)
  })
})

describe('buildDuplicateEntries', () => {
  const week = [src('a', '2026-09-14'), src('b', '2026-09-16'), src('c', '2026-09-20')]

  it('modo semana: mantiene el día de la semana y todo cae en UNA semana', () => {
    const entries = buildDuplicateEntries(week, 'week', '2026-09-21')
    expect(entries.map((e) => e.targetDate)).toEqual(['2026-09-21', '2026-09-23', '2026-09-27'])
    expect(allInOneWeek(entries.map((e) => e.targetDate))).toBe(true)
  })

  it('modo semana: un target que no es lunes se ajusta a su lunes', () => {
    const entries = buildDuplicateEntries(week, 'week', '2026-09-24')
    expect(entries.map((e) => e.targetDate)).toEqual(['2026-09-21', '2026-09-23', '2026-09-27'])
  })

  it('modo fecha: todas al mismo día', () => {
    const entries = buildDuplicateEntries(week, 'date', '2026-09-25')
    expect(new Set(entries.map((e) => e.targetDate))).toEqual(new Set(['2026-09-25']))
  })

  it('conserva hora, instructor y capacidad', () => {
    const [e] = buildDuplicateEntries([src('a', '2026-09-14', '18:30', 'i9')], 'week', '2026-09-21')
    expect(e).toMatchObject({ sourceClassId: 'a', targetTime: '18:30', instructorId: 'i9', maxCapacity: 15 })
  })
})

describe('detectBatchConflicts', () => {
  it('marca mismo instructor, misma fecha y horas traslapadas', () => {
    const entries = buildDuplicateEntries(
      [src('a', '2026-09-14', '07:00'), src('b', '2026-09-15', '07:30')],
      'date',
      '2026-09-25'
    )
    expect(detectBatchConflicts(entries).has(1)).toBe(true)
  })

  it('clases seguidas sin traslape no chocan', () => {
    const entries = buildDuplicateEntries(
      [src('a', '2026-09-14', '07:00'), src('b', '2026-09-15', '08:00')],
      'date',
      '2026-09-25'
    )
    expect(detectBatchConflicts(entries).size).toBe(0)
  })
})
