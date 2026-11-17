import { describe, it, expect } from 'vitest'
import type { AttendedClass } from './summary'
import { buildProgressSummary } from './summary'
import { buildGlance } from './glance'

const DAY_MS = 24 * 3600 * 1000
// Sábado 24-oct-2026, 12:00 en El Salvador
const NOW = new Date('2026-10-24T18:00:00Z')

function cls(iso: string, slug: string, min = 60): AttendedClass {
  return {
    classId: `c-${iso}-${slug}`,
    dateTime: new Date(iso),
    durationMin: min,
    disciplineSlug: slug,
    disciplineName: slug,
    classType: null,
  }
}

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY_MS).toISOString()
}

describe('buildGlance', () => {
  it('sin clases: cero, sin recientes y el primer logro como próximo', () => {
    const g = buildGlance([], NOW)
    expect(g.totalClasses).toBe(0)
    expect(g.week).toEqual({ activeMinutes: 0, targetMinutes: 150 })
    expect(g.streakWeeks).toBe(0)
    expect(g.recentBadges).toEqual([])
    expect(g.nextBadge).toEqual({ id: 'clases-1', title: expect.any(String), current: 0, target: 1 })
  })

  it('recientes: solo lo ganado en los últimos 30 días, lo más nuevo primero', () => {
    const classes = [cls(daysAgo(31), 'pole'), cls(daysAgo(2), 'yoga')]
    const g = buildGlance(classes, NOW)
    const ids = g.recentBadges.map((b) => b.id)

    // Ganados hace 31 días: fuera
    expect(ids).not.toContain('clases-1')
    expect(ids).not.toContain('disciplina-pole-1')
    // Ganado hace 2 días: dentro
    expect(ids).toContain('disciplina-yoga-1')

    for (const b of g.recentBadges) {
      expect(NOW.getTime() - new Date(b.earnedAt).getTime()).toBeLessThanOrEqual(30 * DAY_MS)
    }
    const times = g.recentBadges.map((b) => new Date(b.earnedAt).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('cada reciente trae lo necesario para dibujarlo y celebrarlo', () => {
    const g = buildGlance([cls(daysAgo(1), 'yoga')], NOW)
    const yoga = g.recentBadges.find((b) => b.id === 'disciplina-yoga-1')
    expect(yoga).toMatchObject({
      category: 'disciplinas',
      tier: 1,
      discipline: 'yoga',
      title: expect.any(String),
      description: expect.any(String),
      glyph: expect.any(String),
    })
  })

  it('semana, racha y total vienen del resumen', () => {
    const classes = [cls(daysAgo(1), 'pilates', 50), cls(daysAgo(8), 'pilates', 50), cls(daysAgo(15), 'yoga', 60)]
    const summary = buildProgressSummary(classes, NOW)
    const g = buildGlance(classes, NOW)
    expect(g.totalClasses).toBe(3)
    expect(g.week).toEqual({ activeMinutes: summary.week.activeMinutes, targetMinutes: 150 })
    expect(g.streakWeeks).toBe(summary.streak.weeks)
    expect(g.streakWeeks).toBeGreaterThan(0)
  })

  it('el próximo logro trae su avance', () => {
    const classes = [cls(daysAgo(1), 'pilates'), cls(daysAgo(3), 'pilates'), cls(daysAgo(5), 'pilates')]
    const g = buildGlance(classes, NOW)
    expect(g.nextBadge).not.toBeNull()
    expect(g.nextBadge?.current).toBeGreaterThan(0)
    expect(g.nextBadge?.current).toBeLessThan(g.nextBadge?.target ?? 0)
  })

  it('un reto del año pasado ganado hace poco lleva el año en el título', () => {
    // 5-ene-2027: el reto de diciembre 2026 se ganó hace menos de 30 días
    const now = new Date('2027-01-05T18:00:00Z')
    const dec = ['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-10'].map((d) => cls(`${d}T15:00:00Z`, 'pilates'))
    const g = buildGlance(dec, now)
    const reto = g.recentBadges.find((b) => b.id === 'reto-2026-12')
    expect(reto?.title).toBe('Reto de diciembre 2026')
  })
})
