import type { DuplicateClassEntry, ConflictInfo } from './types'

interface ClassItemForDuplicate {
  id: string
  disciplineId: string
  discipline: string
  complementaryDisciplineId?: string | null
  complementaryDiscipline?: string | null
  instructorId: string
  instructor: string
  dateTime: string
  time: string // HH:MM
  duration: number
  maxCapacity: number
  classType?: string | null
  isCancelled?: boolean
}

/**
 * Get YYYY-MM-DD in El Salvador timezone from a UTC ISO string
 */
function getElSalvadorDateStr(utcDateStr: string): string {
  const date = new Date(utcDateStr)
  const svTime = new Date(date.getTime() - 6 * 60 * 60 * 1000)
  return `${svTime.getUTCFullYear()}-${String(svTime.getUTCMonth() + 1).padStart(2, '0')}-${String(svTime.getUTCDate()).padStart(2, '0')}`
}

/**
 * Get day of week (0=Sun..6=Sat) in El Salvador timezone
 */
function getElSalvadorDayOfWeek(utcDateStr: string): number {
  const date = new Date(utcDateStr)
  const svTime = new Date(date.getTime() - 6 * 60 * 60 * 1000)
  return svTime.getUTCDay()
}

/**
 * Get the Monday (YYYY-MM-DD) of the week containing a given date string
 */
function getMondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Add days to a YYYY-MM-DD string and return YYYY-MM-DD
 */
function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Build DuplicateClassEntry[] from a selection of classes.
 *
 * mode = 'maintain-structure': maps source Monday → target Monday, etc.
 * mode = 'single-date': all classes go to one target date.
 */
export function buildEntriesFromSelection(
  classes: ClassItemForDuplicate[],
  mode: 'maintain-structure' | 'single-date',
  target: string // For maintain-structure: target week Monday (YYYY-MM-DD). For single-date: target date (YYYY-MM-DD).
): DuplicateClassEntry[] {
  return classes.map((cls) => {
    const sourceDate = getElSalvadorDateStr(cls.dateTime)
    let targetDate: string

    if (mode === 'maintain-structure') {
      const sourceMonday = getMondayOfWeek(sourceDate)
      const sourceDow = getElSalvadorDayOfWeek(cls.dateTime)
      // Offset from Monday: Sun=0 → 6 days after Monday, Mon=1 → 0, Tue=2 → 1, etc.
      const daysFromMonday = sourceDow === 0 ? 6 : sourceDow - 1
      targetDate = addDaysToDateStr(target, daysFromMonday)
    } else {
      targetDate = target
    }

    return {
      sourceClassId: cls.id,
      sourceDiscipline: cls.discipline,
      sourceComplementaryDiscipline: cls.complementaryDiscipline || null,
      sourceInstructor: cls.instructor,
      sourceDate,
      sourceTime: cls.time,
      targetDate,
      targetTime: cls.time,
      instructorId: cls.instructorId,
      disciplineId: cls.disciplineId,
      complementaryDisciplineId: cls.complementaryDisciplineId || null,
      duration: cls.duration,
      maxCapacity: cls.maxCapacity,
      classType: cls.classType || null,
    }
  })
}

/**
 * Detect intra-batch conflicts: same instructor + same date + overlapping time.
 */
export function detectConflicts(entries: DuplicateClassEntry[]): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]

      if (a.instructorId !== b.instructorId) continue
      if (a.targetDate !== b.targetDate) continue

      // Check time overlap
      const aStart = timeToMinutes(a.targetTime)
      const aEnd = aStart + a.duration
      const bStart = timeToMinutes(b.targetTime)
      const bEnd = bStart + b.duration

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          entryIndex: j,
          reason: `Conflicto con otra clase del lote: ${a.sourceDiscipline} a las ${a.targetTime}`,
        })
      }
    }
  }

  return conflicts
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Format a YYYY-MM-DD string for display: "Lun 24 Mar"
 */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${days[date.getDay()]} ${d} ${months[m - 1]}`
}

/**
 * Get the 7-day range label for a week starting on Monday
 */
export function formatWeekRange(mondayStr: string): string {
  const sunday = addDaysToDateStr(mondayStr, 6)
  return `${formatDateShort(mondayStr)} — ${formatDateShort(sunday)}`
}

export { addDaysToDateStr, getMondayOfWeek, getElSalvadorDateStr }
