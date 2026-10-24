// Tipos de los logros (insignias) de Mi progreso.

export type BadgeCategory =
  | 'clases'
  | 'disciplinas'
  | 'constancia'
  | 'semanas'
  | 'reto'
  | 'exploradora'
  | 'calma'
  | 'momentos'

export type BadgeTier = 1 | 2 | 3 | 4 | 5

/** Clave del glifo dibujado sobre la insignia. */
export type BadgeGlyph =
  | 'clases'
  | 'pole'
  | 'pilates'
  | 'yoga'
  | 'aro'
  | 'telas'
  | 'soundbath'
  | 'baile'
  | 'racha'
  | 'sol'
  | 'reto'
  | 'brujula'
  | 'loto'
  | 'manianera'
  | 'atardecer'
  | 'doble'
  | 'finde'
  | 'semana-completa'
  | 'aniversario'

export interface BadgeState {
  id: string
  category: BadgeCategory
  title: string
  /** Qué hay que hacer para ganarlo. */
  description: string
  tier: BadgeTier
  target: number
  /** Avance actual, como máximo `target`. */
  current: number
  /** ISO de la clase con que se ganó. */
  earnedAt: string | null
  glyph: BadgeGlyph
  /** Slug de la disciplina, solo en 'disciplinas'. */
  discipline?: string
  /** Texto corto sobre la insignia, ej. "25" o "OCT". */
  label?: string
}

export const CATEGORY_ORDER: BadgeCategory[] = [
  'clases',
  'disciplinas',
  'constancia',
  'semanas',
  'reto',
  'exploradora',
  'calma',
  'momentos',
]

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  clases: 'Clases',
  disciplinas: 'Disciplinas',
  constancia: 'Constancia',
  semanas: 'Semanas activas',
  reto: 'Reto del mes',
  exploradora: 'Exploradora',
  calma: 'Calma',
  momentos: 'Momentos',
}
