import { describe, it, expect } from 'vitest'
import {
  badgeProgressText,
  challengeStatusText,
  formatBadgeDate,
  progressRatio,
  remainingText,
  sectionBadges,
} from './display'
import type { BadgeState } from './types'

function badge(over: Partial<BadgeState> & Pick<BadgeState, 'id'>): BadgeState {
  return {
    category: 'clases',
    title: 't',
    description: 'd',
    tier: 1,
    target: 10,
    current: 0,
    earnedAt: null,
    glyph: 'clases',
    ...over,
  }
}

describe('formatBadgeDate', () => {
  it('usa la fecha de El Salvador y meses cortos en español', () => {
    // 1-nov 03:00 UTC = 31-oct 21:00 en SV
    expect(formatBadgeDate('2026-11-01T03:00:00Z')).toBe('31 oct 2026')
    expect(formatBadgeDate('2026-01-05T15:00:00Z', false)).toBe('5 ene')
  })
})

describe('badgeProgressText', () => {
  it('nombra la unidad según la categoría', () => {
    expect(badgeProgressText(badge({ id: 'clases-10', current: 7 }))).toBe('7 de 10 clases')
    expect(badgeProgressText(badge({ id: 'calma-60', category: 'calma', glyph: 'loto', target: 60, current: 25 }))).toBe(
      '25 de 60 min'
    )
    expect(
      badgeProgressText(badge({ id: 'racha-4', category: 'constancia', glyph: 'racha', target: 4, current: 1 }))
    ).toBe('1 de 4 semanas seguidas')
    expect(
      badgeProgressText(badge({ id: 'momento-doble', category: 'momentos', glyph: 'doble', target: 2, current: 1 }))
    ).toBe('1 de 2 clases en un día')
    expect(
      badgeProgressText(badge({ id: 'aniversario-1', category: 'momentos', glyph: 'aniversario', target: 1, current: 0 }))
    ).toBe('0 de 1 año')
  })
})

describe('remainingText', () => {
  it('cuánto falta, con singular y plural', () => {
    expect(remainingText(badge({ id: 'clases-10', current: 9 }))).toBe('Te falta 1 clase')
    expect(remainingText(badge({ id: 'clases-10', current: 3 }))).toBe('Te faltan 7 clases')
    expect(remainingText(badge({ id: 'calma-60', category: 'calma', glyph: 'loto', target: 60, current: 25 }))).toBe(
      'Te faltan 35 min'
    )
  })
})

describe('progressRatio', () => {
  it('va de 0 a 1', () => {
    expect(progressRatio(badge({ id: 'a', current: 5, target: 10 }))).toBe(0.5)
    expect(progressRatio(badge({ id: 'b', current: 0, target: 0 }))).toBe(0)
    expect(progressRatio(badge({ id: 'c', current: 12, target: 10 }))).toBe(1)
  })
})

describe('challengeStatusText', () => {
  const reto = badge({ id: 'reto-2026-10', category: 'reto', glyph: 'reto', target: 8, current: 5 })

  it('en curso: avance y días que quedan', () => {
    expect(challengeStatusText({ ...reto, daysLeft: 7 })).toBe('Llevas 5 de 8 clases · quedan 7 días')
    expect(challengeStatusText({ ...reto, daysLeft: 1 })).toBe('Llevas 5 de 8 clases · hoy es el último día')
  })

  it('sin clases todavía: sin "llevas 0"', () => {
    expect(challengeStatusText({ ...reto, current: 0, daysLeft: 10 })).toBe('Tu meta: 8 clases · quedan 10 días')
  })

  it('cumplido', () => {
    expect(challengeStatusText({ ...reto, current: 8, earnedAt: '2026-10-21T15:00:00Z', daysLeft: 10 })).toBe(
      '¡Reto cumplido! Lo lograste el 21 oct'
    )
  })
})

describe('sectionBadges', () => {
  const list: BadgeState[] = [
    badge({ id: 'clases-1', target: 1, current: 1, earnedAt: '2026-01-01T15:00:00Z' }),
    badge({ id: 'clases-5', target: 5, current: 3 }),
    badge({ id: 'clases-10', target: 10, current: 3 }),
    badge({ id: 'racha-2', category: 'constancia', target: 2, current: 1 }),
    badge({ id: 'racha-4', category: 'constancia', target: 4, current: 4, earnedAt: '2026-02-01T15:00:00Z' }),
    badge({ id: 'reto-2026-09', category: 'reto', target: 4, current: 4, earnedAt: '2026-09-20T15:00:00Z' }),
    badge({ id: 'reto-2026-10', category: 'reto', target: 4, current: 2 }),
  ]

  it('ganadas primero, luego bloqueadas, manteniendo el orden del catálogo', () => {
    expect(sectionBadges(list, 'clases').map((b) => b.id)).toEqual(['clases-1', 'clases-5', 'clases-10'])
    expect(sectionBadges(list, 'constancia').map((b) => b.id)).toEqual(['racha-4', 'racha-2'])
  })

  it('en el reto solo los meses ganados', () => {
    expect(sectionBadges(list, 'reto').map((b) => b.id)).toEqual(['reto-2026-09'])
  })
})
