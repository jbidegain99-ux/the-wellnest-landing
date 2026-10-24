import { describe, it, expect } from 'vitest'
import type { ProgressGlance } from './glance'
import { glanceStripParts, navbarProgressLabel } from './glanceText'

function glance(over: Partial<ProgressGlance> = {}): ProgressGlance {
  return {
    week: { activeMinutes: 105, targetMinutes: 150 },
    streakWeeks: 9,
    totalClasses: 42,
    nextBadge: { id: 'clases-50', title: '50 clases', current: 42, target: 50 },
    recentBadges: [],
    ...over,
  }
}

describe('glanceStripParts', () => {
  it('semana, racha y próximo logro', () => {
    expect(glanceStripParts(glance())).toEqual([
      '105 de 150 min esta semana',
      'Racha de 9 semanas',
      'Próximo logro: 50 clases (faltan 8)',
    ])
  })

  it('singular en racha y en lo que falta', () => {
    const g = glance({ streakWeeks: 1, nextBadge: { id: 'clases-5', title: '5 clases', current: 4, target: 5 } })
    expect(glanceStripParts(g)).toEqual(['105 de 150 min esta semana', 'Racha de 1 semana', 'Próximo logro: 5 clases (falta 1)'])
  })

  it('sin racha ni próximo logro solo queda la semana', () => {
    expect(glanceStripParts(glance({ streakWeeks: 0, nextBadge: null }))).toEqual(['105 de 150 min esta semana'])
  })
})

describe('navbarProgressLabel', () => {
  it('minutos de la semana y logros nuevos', () => {
    expect(navbarProgressLabel(glance(), 0)).toBe('105 de 150 min esta semana')
    expect(navbarProgressLabel(glance(), 1)).toBe('105 de 150 min esta semana. Tienes 1 logro nuevo')
    expect(navbarProgressLabel(glance(), 3)).toBe('105 de 150 min esta semana. Tienes 3 logros nuevos')
  })
})
