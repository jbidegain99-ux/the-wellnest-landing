// Catálogo declarativo de logros: umbrales, textos y glifos.
// La evaluación (qué se ganó y cuándo) vive en evaluate.ts.

import { MONTH_LABELS, MONTH_NAMES } from '../time'
import type { BadgeCategory, BadgeGlyph, BadgeState, BadgeTier } from './types'

/** Un logro que se gana al llegar a `threshold` en una métrica que solo crece. */
export interface ThresholdBadgeDef {
  id: string
  category: BadgeCategory
  threshold: number
  tier: BadgeTier
  title: string
  description: string
  glyph: BadgeGlyph
  label?: string
  discipline?: string
}

/** Tier según la posición del umbral dentro de su categoría (primero = 1), hasta 5. */
export function tierForIndex(index: number): BadgeTier {
  const t = Math.min(Math.max(index + 1, 1), 5)
  return t as BadgeTier
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

// ── Clases ────────────────────────────────────────────────────────────────

const CLASS_BASE_THRESHOLDS: readonly number[] = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500]
/** Después de 500, un umbral nuevo cada +100, sin fin. */
const CLASS_STEP_AFTER_BASE = 100

/** Umbral de "Clases" en la posición `index` (0 = 1 clase). */
export function classThresholdAt(index: number): number {
  if (index < CLASS_BASE_THRESHOLDS.length) return CLASS_BASE_THRESHOLDS[index]
  const last = CLASS_BASE_THRESHOLDS[CLASS_BASE_THRESHOLDS.length - 1]
  return last + (index - CLASS_BASE_THRESHOLDS.length + 1) * CLASS_STEP_AFTER_BASE
}

/** Cuántos umbrales de "Clases" se muestran después del mayor ganado. */
export const CLASS_UPCOMING = 3

export function classBadgeDef(index: number): ThresholdBadgeDef {
  const n = classThresholdAt(index)
  return {
    id: `clases-${n}`,
    category: 'clases',
    threshold: n,
    tier: tierForIndex(index),
    title: plural(n, '1 clase', `${n} clases`),
    description: n === 1 ? 'Completa tu primera clase en Wellnest.' : `Completa ${n} clases en Wellnest.`,
    glyph: 'clases',
    label: String(n),
  }
}

// ── Disciplinas ───────────────────────────────────────────────────────────

export interface DisciplineDef {
  slug: 'pole' | 'pilates' | 'yoga' | 'aro' | 'telas' | 'soundbath' | 'baile'
  name: string
}

export const BADGE_DISCIPLINES: readonly DisciplineDef[] = [
  { slug: 'pole', name: 'Pole' },
  { slug: 'pilates', name: 'Pilates' },
  { slug: 'yoga', name: 'Yoga' },
  { slug: 'aro', name: 'Aro' },
  { slug: 'telas', name: 'Telas' },
  { slug: 'soundbath', name: 'Terapia de Sonido' },
  { slug: 'baile', name: 'Baile' },
]

/** Slugs de clase que suman a varias disciplinas del catálogo. */
const COMBINED_DISCIPLINES: Record<string, readonly string[]> = {
  'aro-telas': ['aro', 'telas'],
}

/** Disciplinas del catálogo a las que suma una clase (vacío si no tiene fila propia). */
export function badgeDisciplinesFor(slug: string): readonly string[] {
  const combined = COMBINED_DISCIPLINES[slug]
  if (combined) return combined
  return BADGE_DISCIPLINES.some((d) => d.slug === slug) ? [slug] : []
}

const DISCIPLINE_THRESHOLDS: readonly number[] = [1, 10, 25, 50, 100]

export const DISCIPLINE_BADGES: readonly ThresholdBadgeDef[] = BADGE_DISCIPLINES.flatMap((d) =>
  DISCIPLINE_THRESHOLDS.map((n, i) => ({
    id: `disciplina-${d.slug}-${n}`,
    category: 'disciplinas' as const,
    threshold: n,
    tier: tierForIndex(i),
    title: n === 1 ? `Primera clase de ${d.name}` : `${n} clases de ${d.name}`,
    description: n === 1 ? `Toma tu primera clase de ${d.name}.` : `Toma ${n} clases de ${d.name}.`,
    glyph: d.slug,
    label: String(n),
    discipline: d.slug,
  }))
)

// ── Constancia (se gana con la mejor racha; avanza con la actual) ──────

export const STREAK_BADGES: readonly ThresholdBadgeDef[] = [2, 4, 8, 12, 26, 52].map((n, i) => ({
  id: `racha-${n}`,
  category: 'constancia',
  threshold: n,
  tier: tierForIndex(i),
  title: `Racha de ${n} semanas`,
  description: `Ve a clase al menos una vez por semana durante ${n} semanas seguidas.`,
  glyph: 'racha',
  label: String(n),
}))

// ── Semanas activas (≥150 min activos) ────────────────────────────────────

export const ACTIVE_WEEK_BADGES: readonly ThresholdBadgeDef[] = [1, 5, 10, 25, 50].map((n, i) => ({
  id: `semanas-${n}`,
  category: 'semanas',
  threshold: n,
  tier: tierForIndex(i),
  title: plural(n, '1 semana activa', `${n} semanas activas`),
  description:
    n === 1
      ? 'Suma 150 minutos de actividad en una semana.'
      : `Suma 150 minutos de actividad en ${n} semanas distintas.`,
  glyph: 'sol',
  label: String(n),
}))

// ── Exploradora ───────────────────────────────────────────────────────────

export const EXPLORER_BADGES: readonly ThresholdBadgeDef[] = [3, 5, 7].map((n, i) => ({
  id: `exploradora-${n}`,
  category: 'exploradora',
  threshold: n,
  tier: tierForIndex(i),
  title: `Exploradora de ${n} disciplinas`,
  description:
    n === BADGE_DISCIPLINES.length
      ? `Prueba las ${n} disciplinas de Wellnest.`
      : `Prueba ${n} disciplinas distintas.`,
  glyph: 'brujula',
  label: String(n),
}))

// ── Calma (minutos ponderados) ────────────────────────────────────────────

export const CALM_BADGES: readonly ThresholdBadgeDef[] = [60, 180, 600, 1200].map((n, i) => ({
  id: `calma-${n}`,
  category: 'calma',
  threshold: n,
  tier: tierForIndex(i),
  title: `${n} minutos de calma`,
  description: `Acumula ${n} minutos de calma en tus clases.`,
  glyph: 'loto',
  label: String(n),
}))

// ── Momentos ──────────────────────────────────────────────────────────────

export type MomentKey = 'manianera' | 'atardecer' | 'doble' | 'finde' | 'semana-completa'

export interface MomentBadgeDef extends ThresholdBadgeDef {
  moment: MomentKey
}

/** Hora local antes de la cual una clase es "mañanera". */
export const MORNING_BEFORE_HOUR = 9
/** Hora local desde la cual una clase es "de atardecer". */
export const EVENING_FROM_HOUR = 19

const MOMENT_TIER: BadgeTier = 3

export const MOMENT_BADGES: readonly MomentBadgeDef[] = [
  {
    moment: 'manianera',
    id: 'momento-manianera',
    category: 'momentos',
    threshold: 10,
    tier: MOMENT_TIER,
    title: 'Mañanera',
    description: 'Toma 10 clases que empiecen antes de las 9:00.',
    glyph: 'manianera',
  },
  {
    moment: 'atardecer',
    id: 'momento-atardecer',
    category: 'momentos',
    threshold: 10,
    tier: MOMENT_TIER,
    title: 'Atardecer',
    description: 'Toma 10 clases que empiecen desde las 19:00.',
    glyph: 'atardecer',
  },
  {
    moment: 'doble',
    id: 'momento-doble',
    category: 'momentos',
    threshold: 2,
    tier: MOMENT_TIER,
    title: 'Doble sesión',
    description: 'Toma 2 clases el mismo día.',
    glyph: 'doble',
  },
  {
    moment: 'finde',
    id: 'momento-finde',
    category: 'momentos',
    threshold: 5,
    tier: MOMENT_TIER,
    title: 'Fin de semana',
    description: 'Toma 5 clases en sábado o domingo.',
    glyph: 'finde',
  },
  {
    moment: 'semana-completa',
    id: 'momento-semana-completa',
    category: 'momentos',
    threshold: 3,
    tier: MOMENT_TIER,
    title: 'Semana completa',
    description: 'Ve a clase 3 días distintos en una misma semana.',
    glyph: 'semana-completa',
  },
]

export const ANNIVERSARY_BADGES: readonly ThresholdBadgeDef[] = [1, 2, 3].map((n) => ({
  id: `aniversario-${n}`,
  category: 'momentos',
  threshold: n,
  tier: 5,
  title: plural(n, '1 año en Wellnest', `${n} años en Wellnest`),
  description:
    n === 1
      ? 'Vuelve a clase un año después de tu primera clase.'
      : `Vuelve a clase ${n} años después de tu primera clase.`,
  glyph: 'aniversario',
  label: String(n),
}))

// ── Reto del mes ──────────────────────────────────────────────────────────

export const CHALLENGE_TIER: BadgeTier = 4
export const CHALLENGE_MIN_TARGET = 4
export const CHALLENGE_MAX_TARGET = 20
/** Meses anteriores que se promedian para la meta. */
export const CHALLENGE_LOOKBACK_MONTHS = 3

export function challengeId(monthIdx: number): string {
  return `reto-${Math.floor(monthIdx / 12)}-${String((monthIdx % 12) + 1).padStart(2, '0')}`
}

/** Reto de un mes (`monthIdx` = año×12+mes) con su meta, sin avance. */
export function challengeDef(monthIdx: number, target: number): Omit<BadgeState, 'current' | 'earnedAt'> {
  const year = Math.floor(monthIdx / 12)
  const month = monthIdx % 12
  return {
    id: challengeId(monthIdx),
    category: 'reto',
    tier: CHALLENGE_TIER,
    target,
    title: `Reto de ${MONTH_NAMES[month]}`,
    description: `Toma ${target} clases en ${MONTH_NAMES[month]} de ${year}.`,
    glyph: 'reto',
    label: MONTH_LABELS[month].toUpperCase(),
  }
}
