/**
 * Duplicar clases del admin de horarios.
 *
 * Regla de negocio: se duplica UNA semana a la vez. Las clases de origen
 * tienen que pertenecer a una sola semana (lunes a domingo) y las fechas
 * destino también caen dentro de una sola semana. Así un click nunca
 * termina generando clases en varias semanas.
 *
 * Igual que classDates.ts, todo se maneja como 'YYYY-MM-DD' en calendario SV.
 */

import { addDaysToDateStr, getDayOfWeek } from './classDates'

/** Tope de clases por duplicación (una semana cargada cabe de sobra). */
export const MAX_CLASSES_PER_DUPLICATE = 100

export type DuplicateMode = 'week' | 'date'

/** Lunes (YYYY-MM-DD) de la semana lunes-domingo que contiene `dateStr`. */
export function getMondayOfWeek(dateStr: string): string {
  const dow = getDayOfWeek(dateStr)
  return addDaysToDateStr(dateStr, dow === 0 ? -6 : 1 - dow)
}

/** true si todas las fechas caen en la misma semana lunes-domingo. */
export function allInOneWeek(dateStrs: string[]): boolean {
  if (dateStrs.length === 0) return true
  const monday = getMondayOfWeek(dateStrs[0])
  return dateStrs.every((d) => getMondayOfWeek(d) === monday)
}

export interface DuplicateSource {
  id: string
  dateStr: string // fecha SV de la clase original
  time: string // HH:MM
  discipline: string
  complementaryDiscipline: string | null
  instructorId: string
  duration: number
  maxCapacity: number
}

export interface DuplicateEntry {
  sourceClassId: string
  sourceDate: string
  discipline: string
  complementaryDiscipline: string | null
  // Campos editables del destino
  targetDate: string
  targetTime: string
  instructorId: string
  duration: number
  maxCapacity: number
}

/**
 * Arma las filas a crear.
 *
 * - mode 'week': `target` es el lunes de la semana destino; cada clase cae en
 *   el mismo día de la semana que la original (lun → lun, dom → dom).
 * - mode 'date': `target` es una fecha; todas las clases van a ese día.
 */
export function buildDuplicateEntries(
  sources: DuplicateSource[],
  mode: DuplicateMode,
  target: string
): DuplicateEntry[] {
  return sources.map((src) => {
    let targetDate = target
    if (mode === 'week') {
      const offset = (getDayOfWeek(src.dateStr) + 6) % 7 // lun=0 .. dom=6
      targetDate = addDaysToDateStr(getMondayOfWeek(target), offset)
    }
    return {
      sourceClassId: src.id,
      sourceDate: src.dateStr,
      discipline: src.discipline,
      complementaryDiscipline: src.complementaryDiscipline,
      targetDate,
      targetTime: src.time,
      instructorId: src.instructorId,
      duration: src.duration,
      maxCapacity: src.maxCapacity,
    }
  })
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Choques dentro del propio lote: mismo instructor, misma fecha, horas que se
 * traslapan. Devuelve índice de la fila en conflicto → motivo.
 */
export function detectBatchConflicts(entries: DuplicateEntry[]): Map<number, string> {
  const conflicts = new Map<number, string>()
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.instructorId !== b.instructorId || a.targetDate !== b.targetDate) continue
      const aStart = timeToMinutes(a.targetTime)
      const bStart = timeToMinutes(b.targetTime)
      if (aStart < bStart + b.duration && bStart < aStart + a.duration) {
        conflicts.set(j, `Choca con ${a.discipline} a las ${a.targetTime} (mismo instructor)`)
      }
    }
  }
  return conflicts
}
