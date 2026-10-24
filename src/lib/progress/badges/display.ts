// Textos y orden de los logros para la web (puros, sin React).

import { formatInTimeZone } from 'date-fns-tz'
import { MONTH_LABELS, TZ } from '../time'
import type { BadgeCategory, BadgeState } from './types'

/** "12 oct 2026" (o "12 oct" sin año), en la fecha de El Salvador. */
export function formatBadgeDate(iso: string, withYear = true): string {
  const [d, m, y] = formatInTimeZone(new Date(iso), TZ, 'd-M-yyyy').split('-').map(Number)
  const base = `${d} ${MONTH_LABELS[m - 1]}`
  return withYear ? `${base} ${y}` : base
}

function unitFor(badge: BadgeState): [string, string] {
  switch (badge.category) {
    case 'constancia':
      return ['semana seguida', 'semanas seguidas']
    case 'semanas':
      return ['semana activa', 'semanas activas']
    case 'exploradora':
      return ['disciplina', 'disciplinas']
    case 'calma':
      return ['min', 'min']
    case 'momentos':
      if (badge.glyph === 'doble') return ['clase en un día', 'clases en un día']
      if (badge.glyph === 'semana-completa') return ['día en una semana', 'días en una semana']
      if (badge.glyph === 'aniversario') return ['año', 'años']
      return ['clase', 'clases']
    default:
      return ['clase', 'clases']
  }
}

/** "7 de 10 clases". */
export function badgeProgressText(badge: BadgeState): string {
  const [one, many] = unitFor(badge)
  return `${badge.current} de ${badge.target} ${badge.target === 1 ? one : many}`
}

/** "Te faltan 3 clases". */
export function remainingText(badge: BadgeState): string {
  const left = Math.max(0, badge.target - badge.current)
  const [one, many] = unitFor(badge)
  return left === 1 ? `Te falta 1 ${one}` : `Te faltan ${left} ${many}`
}

/** Avance 0–1 para el arco y la barra. */
export function progressRatio(badge: Pick<BadgeState, 'current' | 'target'>): number {
  if (badge.target <= 0) return 0
  return Math.min(1, Math.max(0, badge.current / badge.target))
}

/** Estado del reto del mes en curso, sin culpa: nunca se habla de fallar. */
export function challengeStatusText(challenge: BadgeState & { daysLeft: number }): string {
  if (challenge.earnedAt !== null) {
    return `¡Reto cumplido! Lo lograste el ${formatBadgeDate(challenge.earnedAt, false)}`
  }
  const days = challenge.daysLeft <= 1 ? 'hoy es el último día' : `quedan ${challenge.daysLeft} días`
  const classes = `${challenge.target} ${challenge.target === 1 ? 'clase' : 'clases'}`
  if (challenge.current === 0) return `Tu meta: ${classes} · ${days}`
  return `Llevas ${challenge.current} de ${classes} · ${days}`
}

/**
 * Insignias de una sección: ganadas primero y luego bloqueadas, cada grupo en
 * el orden del catálogo (por umbral). En el reto solo se muestran los meses ganados.
 */
export function sectionBadges(badges: BadgeState[], category: BadgeCategory): BadgeState[] {
  const inCategory = badges.filter((b) => b.category === category)
  const earned = inCategory.filter((b) => b.earnedAt !== null)
  if (category === 'reto') return earned
  return [...earned, ...inCategory.filter((b) => b.earnedAt === null)]
}

/** Los retos de otros años muestran el año: "Reto de octubre 2025". */
export function withChallengeYear(badge: BadgeState, currentYear: number): BadgeState {
  if (badge.category !== 'reto') return badge
  const m = badge.id.match(/^reto-(\d{4})-\d{2}$/)
  if (!m || Number(m[1]) === currentYear) return badge
  return { ...badge, title: `${badge.title} ${m[1]}` }
}
