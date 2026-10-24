// Perfiles por disciplina y estimación de calorías activas por clase.
// Valores según la spec "Mi progreso" (MET del Compendium 2024).

export type Axis = 'fuerza' | 'flexibilidad' | 'equilibrio' | 'core' | 'energia' | 'calma'

export const AXES: Axis[] = ['fuerza', 'flexibilidad', 'equilibrio', 'core', 'energia', 'calma']

export const AXIS_LABELS: Record<Axis, string> = {
  fuerza: 'Fuerza',
  flexibilidad: 'Flexibilidad',
  equilibrio: 'Equilibrio',
  core: 'Core',
  energia: 'Energía',
  calma: 'Calma',
}

export type Intensity = 'Calma' | 'Suave' | 'Moderada' | 'Intensa'

export interface DisciplineProfile {
  met: number
  intensity: Intensity
  focus: string[]
  weights: Record<Axis, number>
}

/** Pesos en el orden de AXES: fuerza, flexibilidad, equilibrio, core, energía, calma. */
function w(
  fuerza: number,
  flexibilidad: number,
  equilibrio: number,
  core: number,
  energia: number,
  calma: number
): Record<Axis, number> {
  return { fuerza, flexibilidad, equilibrio, core, energia, calma }
}

const GENERIC: DisciplineProfile = {
  met: 3.0,
  intensity: 'Moderada',
  focus: ['Movimiento'],
  weights: w(0.5, 0.4, 0.4, 0.5, 0.5, 0.3),
}

const PROFILES: Record<string, DisciplineProfile> = {
  pilates: {
    met: 2.8,
    intensity: 'Moderada',
    focus: ['Core', 'Postura', 'Estabilidad'],
    weights: w(0.5, 0.4, 0.5, 1.0, 0.3, 0.3),
  },
  pole: {
    met: 4.5,
    intensity: 'Intensa',
    focus: ['Tren superior', 'Agarre', 'Core'],
    weights: w(1.0, 0.5, 0.4, 0.8, 0.7, 0.1),
  },
  aro: {
    met: 4.5,
    intensity: 'Intensa',
    focus: ['Tren superior', 'Agarre', 'Flexibilidad'],
    weights: w(0.9, 0.7, 0.5, 0.7, 0.6, 0.1),
  },
  telas: {
    met: 4.5,
    intensity: 'Intensa',
    focus: ['Tren superior', 'Agarre', 'Flexibilidad'],
    weights: w(0.9, 0.7, 0.4, 0.7, 0.6, 0.1),
  },
  'aro-telas': {
    met: 4.5,
    intensity: 'Intensa',
    focus: ['Tren superior', 'Agarre', 'Flexibilidad'],
    weights: w(0.9, 0.7, 0.5, 0.7, 0.6, 0.1),
  },
  baile: {
    met: 5.0,
    intensity: 'Intensa',
    focus: ['Coordinación', 'Cardio', 'Piernas'],
    weights: w(0.4, 0.3, 0.5, 0.4, 1.0, 0.3),
  },
  soundbath: {
    met: 1.0,
    intensity: 'Calma',
    focus: ['Relajación', 'Respiración'],
    weights: w(0, 0, 0, 0, 0, 1.0),
  },
}

const YOGA_FOCUS = ['Flexibilidad', 'Equilibrio', 'Fuerza isométrica']
const YOGA_WEIGHTS = w(0.4, 1.0, 0.8, 0.5, 0.3, 0.7)

/** Minúsculas y sin acentos, para comparar el tipo de clase. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function yogaProfile(classType: string | null): DisciplineProfile {
  const t = classType ? normalize(classType) : ''
  let met = 2.3
  let intensity: Intensity = 'Suave'
  if (t.includes('vinyasa')) {
    met = 2.7
    intensity = 'Moderada'
  } else if (t.includes('sculpt') || t.includes('power')) {
    met = 3.0
    intensity = 'Moderada'
  }
  return { met, intensity, focus: [...YOGA_FOCUS], weights: { ...YOGA_WEIGHTS } }
}

export function getDisciplineProfile(slug: string, classType: string | null): DisciplineProfile {
  if (slug === 'yoga') return yogaProfile(classType)
  const p = PROFILES[slug] ?? GENERIC
  return { ...p, focus: [...p.focus], weights: { ...p.weights } }
}

/** Una clase cuenta como actividad si su MET es al menos 1.5. */
export function isActiveMet(met: number): boolean {
  return met >= 1.5
}

const WEIGHT_RANGE_KG = { low: 55, high: 75 }

/** Calorías activas (sin reposo): (MET − 1) × peso × horas, a la decena más cercana. */
export function estimateActiveKcal(
  met: number,
  minutes: number
): { min: number; max: number } | null {
  if (!isActiveMet(met)) return null
  const hours = minutes / 60
  const round10 = (x: number) => Math.round(x / 10) * 10
  return {
    min: round10((met - 1) * WEIGHT_RANGE_KG.low * hours),
    max: round10((met - 1) * WEIGHT_RANGE_KG.high * hours),
  }
}
