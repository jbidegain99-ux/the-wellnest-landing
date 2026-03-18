export interface DuplicateClassEntry {
  sourceClassId: string
  sourceDiscipline: string
  sourceComplementaryDiscipline: string | null
  sourceInstructor: string
  sourceDate: string // YYYY-MM-DD
  sourceTime: string // HH:MM

  // Editable target fields
  targetDate: string // YYYY-MM-DD
  targetTime: string // HH:MM
  instructorId: string
  disciplineId: string
  complementaryDisciplineId: string | null
  duration: number
  maxCapacity: number
  classType: string | null
}

export interface ConflictInfo {
  entryIndex: number
  reason: string
}

export interface DuplicateApiRequest {
  classes: Array<{
    sourceClassId: string
    targetDate: string // YYYY-MM-DD
    targetTime: string // HH:MM
    instructorId: string
    disciplineId: string
    complementaryDisciplineId: string | null
    duration: number
    maxCapacity: number
    classType: string | null
  }>
}

export interface DuplicateApiResponse {
  created: number
  failed: number
  summary: Array<{
    sourceClassId: string
    targetDate: string
    targetTime: string
    status: 'created' | 'failed'
    error?: string
  }>
}
