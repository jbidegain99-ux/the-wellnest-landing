// Helpers de fecha compartidos por Mi progreso y Logros.
// Todo se calcula en la hora local de El Salvador.

import { formatInTimeZone } from 'date-fns-tz'

export const TZ = 'America/El_Salvador'
const DAY_MS = 24 * 3600 * 1000

export const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export interface LocalParts {
  year: number
  month: number // 0-11
  /** Días desde 1970-01-01 de la fecha local. */
  day: number
  /** Hora local 0-23. */
  hour: number
  /** 1 = lunes … 7 = domingo. */
  isoWeekday: number
}

export function localParts(d: Date): LocalParts {
  const [y, m, dd, hh, wd] = formatInTimeZone(d, TZ, 'yyyy-MM-dd-HH-i').split('-').map(Number)
  return {
    year: y,
    month: m - 1,
    day: Math.round(Date.UTC(y, m - 1, dd) / DAY_MS),
    hour: hh,
    isoWeekday: wd,
  }
}

/** Índice de semana lunes–domingo (el 1-ene-1970 fue jueves). */
export function weekIndex(day: number): number {
  return Math.floor((day + 3) / 7)
}

export function monthIndex(p: { year: number; month: number }): number {
  return p.year * 12 + p.month
}
