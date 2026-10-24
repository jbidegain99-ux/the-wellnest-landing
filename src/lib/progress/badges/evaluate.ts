// Evaluación de logros a partir de las clases asistidas.
// Lógica pura: se recorren las clases en orden cronológico y cada logro guarda
// la fecha de la clase con que cruzó su umbral. Nada se guarda en la base.

import { getDisciplineProfile, isActiveMet } from '../profiles'
import { WEEKLY_TARGET_MINUTES, type AttendedClass } from '../summary'
import { localParts, monthIndex, weekIndex } from '../time'
import {
  ACTIVE_WEEK_BADGES,
  ANNIVERSARY_BADGES,
  BADGE_DISCIPLINES,
  CALM_BADGES,
  CHALLENGE_LOOKBACK_MONTHS,
  CHALLENGE_MAX_TARGET,
  CHALLENGE_MIN_TARGET,
  CLASS_UPCOMING,
  DISCIPLINE_BADGES,
  EVENING_FROM_HOUR,
  EXPLORER_BADGES,
  MOMENT_BADGES,
  MORNING_BEFORE_HOUR,
  STREAK_BADGES,
  badgeDisciplinesFor,
  challengeDef,
  challengeId,
  classBadgeDef,
  classThresholdAt,
  type MomentKey,
  type ThresholdBadgeDef,
} from './catalog'
import type { BadgeState } from './types'

const DAY_MS = 24 * 3600 * 1000

/** Métrica que solo crece; recuerda cuándo alcanzó cada valor. */
class Tracker {
  value = 0
  private readonly steps: { value: number; at: Date }[] = []

  raise(value: number, at: Date): void {
    if (value <= this.value) return
    this.value = value
    this.steps.push({ value, at })
  }

  add(delta: number, at: Date): void {
    this.raise(this.value + delta, at)
  }

  earnedAt(threshold: number): string | null {
    const step = this.steps.find((s) => s.value >= threshold)
    return step ? step.at.toISOString() : null
  }
}

/** Avance mostrado: el umbral si se ganó; si no, el valor redondeado sin llegar al umbral. */
function shownCurrent(value: number, target: number, earned: boolean): number {
  if (earned) return target
  return Math.max(0, Math.min(Math.round(value), target - 1))
}

function toState(def: ThresholdBadgeDef, tracker: Tracker): BadgeState {
  const earnedAt = tracker.earnedAt(def.threshold)
  const state: BadgeState = {
    id: def.id,
    category: def.category,
    title: def.title,
    description: def.description,
    tier: def.tier,
    target: def.threshold,
    current: shownCurrent(tracker.value, def.threshold, earnedAt !== null),
    earnedAt,
    glyph: def.glyph,
  }
  if (def.discipline !== undefined) state.discipline = def.discipline
  if (def.label !== undefined) state.label = def.label
  return state
}

/** Años completos entre dos instantes (fecha + N años, en UTC). */
function fullYearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear()
  const shifted = (n: number) => {
    const d = new Date(from.getTime())
    d.setUTCFullYear(from.getUTCFullYear() + n)
    return d.getTime()
  }
  while (years > 0 && shifted(years) > to.getTime()) years--
  return Math.max(0, years)
}

/** Meta del reto a partir de las clases por mes (`año×12+mes` → clases). */
function targetFromMonthCounts(counts: ReadonlyMap<number, number>, monthIdx: number): number {
  let hasHistory = false
  let sum = 0
  counts.forEach((n, m) => {
    if (m < monthIdx && n > 0) hasHistory = true
    if (m < monthIdx && m >= monthIdx - CHALLENGE_LOOKBACK_MONTHS) sum += n
  })
  if (!hasHistory) return CHALLENGE_MIN_TARGET
  // promedio × 1.1 = sum × 11 / (10 × meses), en enteros para evitar errores de coma flotante
  const raw = Math.ceil((sum * 11) / (10 * CHALLENGE_LOOKBACK_MONTHS))
  return Math.min(CHALLENGE_MAX_TARGET, Math.max(CHALLENGE_MIN_TARGET, raw))
}

/**
 * Meta personal del reto del mes `monthIdx`:
 * clamp(ceil(promedio de los 3 meses anteriores, contando ceros, × 1.1), 4, 20); sin historial = 4.
 */
export function monthlyTarget(classes: AttendedClass[], monthIdx: number): number {
  const counts = new Map<number, number>()
  for (const c of classes) {
    const m = monthIndex(localParts(c.dateTime))
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return targetFromMonthCounts(counts, monthIdx)
}

export function evaluateBadges(classes: AttendedClass[], now: Date): BadgeState[] {
  const nowMs = now.getTime()
  const curMonth = monthIndex(localParts(now))
  const items = classes
    .filter((c) => c.dateTime.getTime() <= nowMs)
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())

  const total = new Tracker()
  const perDiscipline = new Map<string, Tracker>(BADGE_DISCIPLINES.map((d) => [d.slug, new Tracker()]))
  const explored = new Set<string>()
  const explorer = new Tracker()
  const streak = new Tracker()
  let lastWeek: number | null = null
  let run = 0
  const activeMinutesByWeek = new Map<number, number>()
  const activeWeeks = new Tracker()
  const calm = new Tracker()
  let calmSum = 0
  const moments: Record<MomentKey, Tracker> = {
    manianera: new Tracker(),
    atardecer: new Tracker(),
    doble: new Tracker(),
    finde: new Tracker(),
    'semana-completa': new Tracker(),
  }
  const classesByDay = new Map<number, number>()
  const daysByWeek = new Map<number, Set<number>>()
  const monthCounts = new Map<number, number>()
  const monthTrackers = new Map<number, Tracker>()
  const anniversary = new Tracker()
  let firstClass: Date | null = null

  for (const c of items) {
    const at = c.dateTime
    const p = localParts(at)
    const week = weekIndex(p.day)
    const month = monthIndex(p)
    const profile = getDisciplineProfile(c.disciplineSlug, c.classType)
    const minutes = c.durationMin > 0 ? c.durationMin : 0

    // Clases, disciplinas y exploradora
    total.add(1, at)
    for (const slug of badgeDisciplinesFor(c.disciplineSlug)) {
      perDiscipline.get(slug)?.add(1, at)
      explored.add(slug)
    }
    explorer.raise(explored.size, at)

    // Constancia: mejor racha de semanas seguidas con clase
    if (lastWeek === null || week > lastWeek + 1) run = 1
    else if (week === lastWeek + 1) run++
    lastWeek = week
    streak.raise(run, at)

    // Semanas activas
    if (isActiveMet(profile.met) && minutes > 0) {
      const before = activeMinutesByWeek.get(week) ?? 0
      const after = before + minutes
      activeMinutesByWeek.set(week, after)
      if (before < WEEKLY_TARGET_MINUTES && after >= WEEKLY_TARGET_MINUTES) activeWeeks.add(1, at)
    }

    // Calma (misma ponderación que Mi progreso)
    calmSum += minutes * profile.weights.calma
    calm.raise(Math.round(calmSum * 1000) / 1000, at)

    // Momentos
    if (p.hour < MORNING_BEFORE_HOUR) moments.manianera.add(1, at)
    if (p.hour >= EVENING_FROM_HOUR) moments.atardecer.add(1, at)
    if (p.isoWeekday >= 6) moments.finde.add(1, at)
    const sameDay = (classesByDay.get(p.day) ?? 0) + 1
    classesByDay.set(p.day, sameDay)
    moments.doble.raise(sameDay, at)
    const days = daysByWeek.get(week) ?? new Set<number>()
    days.add(p.day)
    daysByWeek.set(week, days)
    moments['semana-completa'].raise(days.size, at)

    // Aniversario
    if (firstClass === null) firstClass = at
    anniversary.raise(fullYearsBetween(firstClass, at), at)

    // Reto del mes
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
    const mt = monthTrackers.get(month) ?? new Tracker()
    mt.add(1, at)
    monthTrackers.set(month, mt)
  }

  const badges: BadgeState[] = []

  // Clases: las ganadas + las próximas 3
  let earnedClassBadges = 0
  while (classThresholdAt(earnedClassBadges) <= total.value) earnedClassBadges++
  for (let i = 0; i < earnedClassBadges + CLASS_UPCOMING; i++) badges.push(toState(classBadgeDef(i), total))

  for (const def of DISCIPLINE_BADGES) {
    const tracker = def.discipline ? perDiscipline.get(def.discipline) : undefined
    badges.push(toState(def, tracker ?? new Tracker()))
  }
  for (const def of STREAK_BADGES) badges.push(toState(def, streak))
  for (const def of ACTIVE_WEEK_BADGES) badges.push(toState(def, activeWeeks))

  // Reto: meses ganados + el mes en curso
  const challengeMonths = Array.from(monthTrackers.keys()).filter((m) => m !== curMonth)
  challengeMonths.push(curMonth)
  challengeMonths.sort((a, b) => a - b)
  for (const m of challengeMonths) {
    const target = targetFromMonthCounts(monthCounts, m)
    const tracker = monthTrackers.get(m) ?? new Tracker()
    const earnedAt = tracker.earnedAt(target)
    if (earnedAt === null && m !== curMonth) continue
    badges.push({
      ...challengeDef(m, target),
      current: shownCurrent(tracker.value, target, earnedAt !== null),
      earnedAt,
    })
  }

  for (const def of EXPLORER_BADGES) badges.push(toState(def, explorer))
  for (const def of CALM_BADGES) badges.push(toState(def, calm))
  for (const def of MOMENT_BADGES) badges.push(toState(def, moments[def.moment]))
  for (const def of ANNIVERSARY_BADGES) badges.push(toState(def, anniversary))

  return badges
}

/** El reto del mes en curso con los días que quedan (incluido hoy). */
export function currentChallenge(badges: BadgeState[], now: Date): BadgeState & { daysLeft: number } {
  const p = localParts(now)
  const id = challengeId(monthIndex(p))
  const challenge = badges.find((b) => b.id === id)
  if (!challenge) throw new Error(`currentChallenge: no hay reto ${id}; evalúa los logros con la misma fecha`)
  const firstOfNextMonth = Math.round(Date.UTC(p.year, p.month + 1, 1) / DAY_MS)
  return { ...challenge, daysLeft: firstOfNextMonth - p.day }
}

/** Los `n` logros sin ganar más cercanos (con avance primero, por porcentaje). Sin el reto. */
export function nextBadges(badges: BadgeState[], n: number): BadgeState[] {
  return badges
    .filter((b) => b.earnedAt === null && b.category !== 'reto')
    .sort((a, b) => {
      const startedA = a.current > 0 ? 0 : 1
      const startedB = b.current > 0 ? 0 : 1
      if (startedA !== startedB) return startedA - startedB
      const ratio = b.current / b.target - a.current / a.target
      if (ratio !== 0) return ratio
      return a.target - b.target
    })
    .slice(0, n)
}

/** Los `n` logros ganados más recientes. */
export function recentBadges(badges: BadgeState[], n: number): BadgeState[] {
  return badges
    .filter((b): b is BadgeState & { earnedAt: string } => b.earnedAt !== null)
    .sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : a.earnedAt > b.earnedAt ? -1 : 0))
    .slice(0, n)
}
