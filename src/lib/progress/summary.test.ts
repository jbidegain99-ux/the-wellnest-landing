import { describe, it, expect } from 'vitest'
import {
  buildProgressSummary,
  EXPLORER_DISCIPLINES,
  MILESTONES,
  WEEKLY_TARGET_MINUTES,
  type AttendedClass,
} from './summary'

const NOW = new Date('2026-10-24T18:00:00Z') // sábado 24-oct SV

function cls(
  iso: string,
  slug = 'pole',
  durationMin = 60,
  extra: Partial<AttendedClass> = {}
): AttendedClass {
  return {
    classId: `c-${iso}-${slug}`,
    dateTime: new Date(iso),
    durationMin,
    disciplineSlug: slug,
    disciplineName: slug,
    classType: null,
    ...extra,
  }
}

/** Misma hora del día que NOW, `weeks` semanas antes. */
function weeksAgo(weeks: number, slug = 'pole'): AttendedClass {
  return cls(new Date(NOW.getTime() - weeks * 7 * 24 * 3600 * 1000).toISOString(), slug)
}

describe('buildProgressSummary', () => {
  it('sin clases', () => {
    const s = buildProgressSummary([], NOW)
    expect(s.totalClasses).toBe(0)
    expect(s.lastClass).toBeNull()
    expect(s.mix30d).toBeNull()
    expect(s.streak.weeks).toBe(0)
    expect(s.milestones.next).toBe(1)
    expect(s.milestones.remaining).toBe(1)
    expect(s.months.map((m) => m.label)).toEqual([
      'may 2026',
      'jun 2026',
      'jul 2026',
      'ago 2026',
      'sep 2026',
      'oct 2026',
    ])
    expect(s.months.every((m) => m.classes === 0 && m.minutes === 0)).toBe(true)
  })

  it('última clase con kcal', () => {
    const s = buildProgressSummary(
      [cls('2026-10-20T15:00:00Z', 'yoga'), cls('2026-10-22T15:00:00Z', 'pole')],
      NOW
    )
    expect(s.lastClass?.classId).toBe('c-2026-10-22T15:00:00Z-pole')
    expect(s.lastClass?.date).toBe('2026-10-22T15:00:00.000Z')
    expect(s.lastClass?.intensity).toBe('Intensa')
    expect(s.lastClass?.minutes).toBe(60)
    expect(s.lastClass?.kcal).toEqual({ min: 190, max: 260 })
  })

  it('semana en hora de El Salvador', () => {
    const before = buildProgressSummary([cls('2026-10-19T05:30:00Z')], NOW)
    expect(before.week.classes).toBe(0)
    const after = buildProgressSummary([cls('2026-10-19T06:30:00Z')], NOW)
    expect(after.week.classes).toBe(1)
    expect(after.week.activeMinutes).toBe(60)
    expect(after.week.targetMinutes).toBe(150)
  })

  it('terapia de sonido suma a calma, no a activos', () => {
    const s = buildProgressSummary([cls('2026-10-21T15:00:00Z', 'soundbath', 55)], NOW)
    expect(s.week.activeMinutes).toBe(0)
    expect(s.week.calmMinutes).toBe(55)
    expect(s.lastClass?.kcal).toBeNull()
  })

  it('racha', () => {
    const a = buildProgressSummary([weeksAgo(0), weeksAgo(1), weeksAgo(2), weeksAgo(4)], NOW)
    expect(a.streak).toEqual({ weeks: 3, currentWeekHasClass: true })
    const b = buildProgressSummary([weeksAgo(1), weeksAgo(2)], NOW)
    expect(b.streak).toEqual({ weeks: 2, currentWeekHasClass: false })
  })

  it('mix30d', () => {
    const s = buildProgressSummary([cls('2026-10-20T15:00:00Z', 'pole', 60)], NOW)
    expect(s.mix30d?.fuerza).toBe(1)
    expect(s.mix30d?.calma).toBeCloseTo(0.1, 2)
    const old = buildProgressSummary(
      [cls(new Date(NOW.getTime() - 31 * 24 * 3600 * 1000).toISOString())],
      NOW
    )
    expect(old.mix30d).toBeNull()
  })

  it('mes actual vs anterior', () => {
    const s = buildProgressSummary(
      [cls('2026-10-10T15:00:00Z', 'yoga', 60), cls('2026-09-10T15:00:00Z', 'yoga', 60)],
      NOW
    )
    expect(s.month.current.flexMinutes).toBe(60)
    expect(s.month.current.calmMinutes).toBe(42)
    expect(s.month.previous.classes).toBe(1)
    expect(s.month.previous.label).toBe('sep 2026')
  })

  it('hitos', () => {
    const base = Array.from({ length: 12 }, (_, i) =>
      cls(`2026-0${(i % 8) + 1}-1${i % 9}T15:00:00Z`, i % 2 ? 'yoga' : 'pole')
    )
    const s = buildProgressSummary(base, NOW)
    expect(s.milestones.reached).toEqual([1, 10])
    expect(s.milestones.next).toBe(25)
    expect(s.milestones.remaining).toBe(13)
    expect(s.milestones.explorer).toEqual({ disciplines: 2, reached: false })
    const s3 = buildProgressSummary([...base, cls('2026-02-02T15:00:00Z', 'pilates')], NOW)
    expect(s3.milestones.explorer.reached).toBe(true)
  })

  it('ignora clases futuras', () => {
    const s = buildProgressSummary([cls('2026-10-25T15:00:00Z')], NOW)
    expect(s.totalClasses).toBe(0)
  })

  it('es serializable a JSON', () => {
    const s = buildProgressSummary([cls('2026-10-20T15:00:00Z')], NOW)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})

describe('constantes exportadas', () => {
  it('coinciden con lo que usa el resumen', () => {
    expect(MILESTONES).toEqual([1, 10, 25, 50, 100])
    expect(EXPLORER_DISCIPLINES).toBe(3)
    expect(WEEKLY_TARGET_MINUTES).toBe(150)
    const s = buildProgressSummary([], NOW)
    expect(s.week.targetMinutes).toBe(WEEKLY_TARGET_MINUTES)
    expect(s.milestones.next).toBe(MILESTONES[0])
  })
})
