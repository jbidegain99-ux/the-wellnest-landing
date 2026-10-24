// Resumen de progreso de una usuaria a partir de sus clases asistidas.
// Lógica pura: sin base de datos. Todo el cálculo por fecha usa America/El_Salvador.

import { formatInTimeZone } from 'date-fns-tz'
import {
  AXES,
  getDisciplineProfile,
  estimateActiveKcal,
  isActiveMet,
  type Axis,
  type Intensity,
} from './profiles'

const TZ = 'America/El_Salvador'
const DAY_MS = 24 * 3600 * 1000
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MILESTONES = [1, 10, 25, 50, 100]
const EXPLORER_DISCIPLINES = 3

export interface AttendedClass {
  classId: string
  dateTime: Date
  durationMin: number
  disciplineSlug: string
  disciplineName: string
  classType: string | null
}

export interface ClassSummary {
  classId: string
  date: string
  disciplineName: string
  classType: string | null
  minutes: number
  intensity: Intensity
  focus: string[]
  kcal: { min: number; max: number } | null
}

export interface MonthStat {
  label: string
  classes: number
  minutes: number
  flexMinutes: number
  calmMinutes: number
}

export interface ProgressSummary {
  totalClasses: number
  lastClass: ClassSummary | null
  week: { activeMinutes: number; calmMinutes: number; classes: number; targetMinutes: 150 }
  streak: { weeks: number; currentWeekHasClass: boolean }
  mix30d: Record<Axis, number> | null
  month: { current: MonthStat; previous: MonthStat }
  milestones: {
    reached: number[]
    next: number | null
    remaining: number | null
    explorer: { disciplines: number; reached: boolean }
  }
  months: MonthStat[]
}

interface LocalParts {
  year: number
  month: number // 0-11
  /** Días desde 1970-01-01 de la fecha local. */
  day: number
}

function localParts(d: Date): LocalParts {
  const [y, m, dd] = formatInTimeZone(d, TZ, 'yyyy-MM-dd').split('-').map(Number)
  return { year: y, month: m - 1, day: Math.round(Date.UTC(y, m - 1, dd) / DAY_MS) }
}

/** Índice de semana lunes–domingo (el 1-ene-1970 fue jueves). */
function weekIndex(day: number): number {
  return Math.floor((day + 3) / 7)
}

function monthIndex(p: LocalParts): number {
  return p.year * 12 + p.month
}

function monthLabel(idx: number): string {
  return `${MONTH_LABELS[idx % 12]} ${Math.floor(idx / 12)}`
}

interface Enriched {
  cls: AttendedClass
  minutes: number
  met: number
  weights: Record<Axis, number>
  week: number
  month: number
}

function emptyAxes(): Record<Axis, number> {
  return { fuerza: 0, flexibilidad: 0, equilibrio: 0, core: 0, energia: 0, calma: 0 }
}

export function buildProgressSummary(classes: AttendedClass[], now: Date): ProgressSummary {
  const nowMs = now.getTime()
  const nowParts = localParts(now)
  const curWeek = weekIndex(nowParts.day)
  const curMonth = monthIndex(nowParts)

  const items: Enriched[] = classes
    .filter((c) => c.dateTime.getTime() <= nowMs)
    .map((c) => {
      const profile = getDisciplineProfile(c.disciplineSlug, c.classType)
      const p = localParts(c.dateTime)
      return {
        cls: c,
        minutes: c.durationMin > 0 ? c.durationMin : 0,
        met: profile.met,
        weights: profile.weights,
        week: weekIndex(p.day),
        month: monthIndex(p),
      }
    })

  // Última clase
  let last: Enriched | null = null
  for (const it of items) {
    if (!last || it.cls.dateTime.getTime() > last.cls.dateTime.getTime()) last = it
  }
  let lastClass: ClassSummary | null = null
  if (last) {
    const profile = getDisciplineProfile(last.cls.disciplineSlug, last.cls.classType)
    lastClass = {
      classId: last.cls.classId,
      date: last.cls.dateTime.toISOString(),
      disciplineName: last.cls.disciplineName,
      classType: last.cls.classType,
      minutes: last.minutes,
      intensity: profile.intensity,
      focus: profile.focus,
      kcal: estimateActiveKcal(profile.met, last.minutes),
    }
  }

  // Semana actual
  let activeMinutes = 0
  let calmMinutes = 0
  let weekClasses = 0
  for (const it of items) {
    if (it.week !== curWeek) continue
    weekClasses++
    if (isActiveMet(it.met)) activeMinutes += it.minutes
    else calmMinutes += it.minutes
  }

  // Racha
  const weeksWithClass = new Set(items.map((it) => it.week))
  const currentWeekHasClass = weeksWithClass.has(curWeek)
  let streakWeeks = 0
  for (let w = currentWeekHasClass ? curWeek : curWeek - 1; weeksWithClass.has(w); w--) {
    streakWeeks++
  }

  // Mezcla de los últimos 30 días
  const sums = emptyAxes()
  let mixMinutes = 0
  for (const it of items) {
    if (it.cls.dateTime.getTime() <= nowMs - 30 * DAY_MS || it.minutes === 0) continue
    mixMinutes += it.minutes
    for (const a of AXES) sums[a] += it.minutes * it.weights[a]
  }
  const maxAxis = Math.max(...AXES.map((a) => sums[a]))
  let mix30d: Record<Axis, number> | null = null
  if (mixMinutes > 0 && maxAxis > 0) {
    mix30d = emptyAxes()
    for (const a of AXES) mix30d[a] = Math.round((sums[a] / maxAxis) * 100) / 100
  }

  // Meses
  const monthStat = (idx: number): MonthStat => {
    let count = 0
    let minutes = 0
    let flex = 0
    let calm = 0
    for (const it of items) {
      if (it.month !== idx) continue
      count++
      minutes += it.minutes
      flex += it.minutes * it.weights.flexibilidad
      calm += it.minutes * it.weights.calma
    }
    return {
      label: monthLabel(idx),
      classes: count,
      minutes,
      flexMinutes: Math.round(flex),
      calmMinutes: Math.round(calm),
    }
  }
  const months: MonthStat[] = []
  for (let i = 5; i >= 0; i--) months.push(monthStat(curMonth - i))

  // Hitos
  const total = items.length
  const next = MILESTONES.find((m) => m > total) ?? null
  const disciplines = new Set(items.map((it) => it.cls.disciplineSlug)).size

  return {
    totalClasses: total,
    lastClass,
    week: { activeMinutes, calmMinutes, classes: weekClasses, targetMinutes: 150 },
    streak: { weeks: streakWeeks, currentWeekHasClass },
    mix30d,
    month: { current: months[5], previous: months[4] },
    milestones: {
      reached: MILESTONES.filter((m) => m <= total),
      next,
      remaining: next === null ? null : next - total,
      explorer: { disciplines, reached: disciplines >= EXPLORER_DISCIPLINES },
    },
    months,
  }
}
