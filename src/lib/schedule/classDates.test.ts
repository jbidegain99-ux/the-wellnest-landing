import { describe, it, expect } from 'vitest'
import {
  addDaysToDateStr,
  expandWeekdayPattern,
  formatDateLong,
  formatDateShort,
  mergeDateSelection,
  toDateStr,
} from './classDates'

describe('toDateStr / addDaysToDateStr', () => {
  it('formatea con ceros a la izquierda', () => {
    expect(toDateStr(2026, 0, 5)).toBe('2026-01-05')
    expect(toDateStr(2026, 11, 31)).toBe('2026-12-31')
  })

  it('cruza el fin de mes', () => {
    expect(addDaysToDateStr('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysToDateStr('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('cruza el fin de año', () => {
    expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('respeta el año bisiesto', () => {
    expect(addDaysToDateStr('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('expandWeekdayPattern', () => {
  // 2026-09-07 es lunes.
  it('genera una fecha por cada día marcado dentro del rango', () => {
    // lunes(1), miércoles(3), viernes(5) del 7 al 13 de septiembre 2026
    expect(expandWeekdayPattern([1, 3, 5], '2026-09-07', '2026-09-13')).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
    ])
  })

  it('incluye ambos extremos del rango', () => {
    expect(expandWeekdayPattern([1], '2026-09-07', '2026-09-14')).toEqual([
      '2026-09-07',
      '2026-09-14',
    ])
  })

  it('devuelve las fechas ordenadas aunque los días vengan desordenados', () => {
    expect(expandWeekdayPattern([5, 1], '2026-09-07', '2026-09-11')).toEqual([
      '2026-09-07',
      '2026-09-11',
    ])
  })

  it('cruza meses', () => {
    expect(expandWeekdayPattern([2], '2026-09-28', '2026-10-07')).toEqual([
      '2026-09-29',
      '2026-10-06',
    ])
  })

  it('devuelve vacío si no hay días marcados', () => {
    expect(expandWeekdayPattern([], '2026-09-07', '2026-12-31')).toEqual([])
  })

  it('devuelve vacío si el rango está invertido', () => {
    expect(expandWeekdayPattern([1], '2026-09-14', '2026-09-07')).toEqual([])
  })

  it('maneja domingo (0) sin confundirlo con "sin selección"', () => {
    expect(expandWeekdayPattern([0], '2026-09-07', '2026-09-20')).toEqual([
      '2026-09-13',
      '2026-09-20',
    ])
  })

  it('corta el rango para que no exceda el límite de fechas', () => {
    const result = expandWeekdayPattern([1, 2, 3, 4, 5], '2026-01-01', '2027-12-31')
    expect(result.length).toBeLessThanOrEqual(100)
  })
})

describe('mergeDateSelection', () => {
  it('une patrón y fechas sueltas sin duplicar', () => {
    expect(mergeDateSelection(['2026-09-07', '2026-09-09'], ['2026-09-09', '2026-09-12'])).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-12',
    ])
  })

  it('ordena cronológicamente', () => {
    expect(mergeDateSelection(['2026-10-01'], ['2026-09-30'])).toEqual([
      '2026-09-30',
      '2026-10-01',
    ])
  })

  it('descarta fechas anteriores a hoy pero conserva hoy', () => {
    expect(
      mergeDateSelection(['2026-09-04', '2026-09-05', '2026-09-06'], [], '2026-09-05')
    ).toEqual(['2026-09-05', '2026-09-06'])
  })

  it('devuelve vacío cuando ambas listas están vacías', () => {
    expect(mergeDateSelection([], [])).toEqual([])
  })
})

describe('formatDateShort / formatDateLong', () => {
  it('usa nombres en español sin depender del locale del navegador', () => {
    expect(formatDateShort('2026-09-07')).toBe('Lun 7 Sep')
    expect(formatDateLong('2026-09-07')).toBe('Lunes 7 de septiembre')
  })

  it('no se corre de día por zona horaria', () => {
    // Parseado como fecha local, no como UTC medianoche.
    expect(formatDateShort('2026-01-01')).toBe('Jue 1 Ene')
  })
})
