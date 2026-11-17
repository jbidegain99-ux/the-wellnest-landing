// Vistazo al progreso para el Navbar, la franja de la home y la celebración.
// Lógica pura: sin base de datos.

import { buildProgressSummary, WEEKLY_TARGET_MINUTES, type AttendedClass } from './summary'
import { currentChallenge, evaluateBadges, nextBadges, recentBadges } from './badges/evaluate'
import { withChallengeYear } from './badges/display'
import type { BadgeCategory, BadgeGlyph, BadgeState, BadgeTier } from './badges/types'
import { localParts } from './time'

const DAY_MS = 24 * 3600 * 1000
/** Los logros ganados en esta ventana cuentan como recientes. */
export const RECENT_BADGE_DAYS = 30

/** Lo justo de un logro ganado para dibujar su medalla y celebrarlo. */
export interface GlanceBadge {
  id: string
  title: string
  description: string
  category: BadgeCategory
  tier: BadgeTier
  glyph: BadgeGlyph
  label?: string
  discipline?: string
  earnedAt: string
}

export interface ProgressGlance {
  week: { activeMinutes: number; targetMinutes: number }
  streakWeeks: number
  totalClasses: number
  nextBadge: { id: string; title: string; current: number; target: number } | null
  /** Ganados en los últimos 30 días, lo más nuevo primero. */
  recentBadges: GlanceBadge[]
}

function toGlanceBadge(b: BadgeState & { earnedAt: string }): GlanceBadge {
  const out: GlanceBadge = {
    id: b.id,
    title: b.title,
    description: b.description,
    category: b.category,
    tier: b.tier,
    glyph: b.glyph,
    earnedAt: b.earnedAt,
  }
  if (b.label !== undefined) out.label = b.label
  if (b.discipline !== undefined) out.discipline = b.discipline
  return out
}

export function buildGlance(classes: AttendedClass[], now: Date): ProgressGlance {
  const summary = buildProgressSummary(classes, now)
  const year = localParts(now).year
  // La misma fecha para evaluar y para buscar el reto del mes.
  const badges = evaluateBadges(classes, now).map((b) => withChallengeYear(b, year))

  const since = now.getTime() - RECENT_BADGE_DAYS * DAY_MS
  const recent = recentBadges(badges, badges.length)
    .filter((b): b is BadgeState & { earnedAt: string } => b.earnedAt !== null && new Date(b.earnedAt).getTime() >= since)
    .map(toGlanceBadge)

  const challenge = currentChallenge(badges, now)
  const next = nextBadges(badges, 1)[0] ?? (challenge.earnedAt === null ? challenge : null)

  return {
    week: { activeMinutes: summary.week.activeMinutes, targetMinutes: WEEKLY_TARGET_MINUTES },
    streakWeeks: summary.streak.weeks,
    totalClasses: summary.totalClasses,
    nextBadge: next ? { id: next.id, title: next.title, current: next.current, target: next.target } : null,
    recentBadges: recent,
  }
}
