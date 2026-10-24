// Ayudas de presentación para la página Mi progreso (puras, sin React).

import { AXES, type Axis } from './profiles'

const MONTHS: Record<string, string> = {
  ene: 'enero',
  feb: 'febrero',
  mar: 'marzo',
  abr: 'abril',
  may: 'mayo',
  jun: 'junio',
  jul: 'julio',
  ago: 'agosto',
  sep: 'septiembre',
  oct: 'octubre',
  nov: 'noviembre',
  dic: 'diciembre',
}

/** Los `n` ejes con más peso (descarta ceros); empate → orden de AXES. */
export function topAxes(mix: Record<Axis, number>, n: number): Axis[] {
  return AXES.filter((a) => mix[a] > 0)
    .sort((a, b) => mix[b] - mix[a])
    .slice(0, n)
}

/** "sep 2026" → "septiembre". */
export function monthFullName(label: string): string {
  const abbr = label.split(' ')[0]
  return MONTHS[abbr] ?? label
}

/** "sep 2026" → "Sep". */
export function monthShortName(label: string): string {
  const abbr = label.split(' ')[0]
  return abbr.charAt(0).toUpperCase() + abbr.slice(1)
}

/**
 * Comparación con el mes anterior. Si este mes va por debajo no se resta
 * (el mes no ha terminado y no queremos culpa): se muestra el dato anterior.
 */
export function monthDeltaText(current: number, previous: number, previousLabel: string): string | null {
  if (current === 0 && previous === 0) return null
  const month = monthFullName(previousLabel)
  if (current > previous) return `+${current - previous} min vs. ${month}`
  if (current === previous) return `Igual que en ${month}`
  return `En ${month}: ${previous} min`
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
