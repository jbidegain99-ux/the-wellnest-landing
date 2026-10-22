import { describe, it, expect } from 'vitest'
import { eventDateLine, eventDateSentence, eventHref, partitionEvents, eventTheme, titleParts, morningAfterLine } from './format'

const VB_START = new Date('2026-10-31T00:30:00Z') // 30-oct 6:30 p. m. en El Salvador

describe('formato de fechas (hora de El Salvador)', () => {
  it('línea en mayúsculas como en la invitación', () => expect(eventDateLine(VB_START)).toBe('VIERNES 30 DE OCTUBRE · 6:30 P. M.'))
  it('frase normal', () => expect(eventDateSentence(VB_START)).toBe('Viernes 30 de octubre · 6:30 p. m.'))
  it('mañana', () => expect(eventDateSentence(new Date('2026-11-14T15:00:00Z'))).toBe('Sábado 14 de noviembre · 9:00 a. m.'))
})

describe('eventHref', () => {
  it('landing propia', () => expect(eventHref({ slug: 'villains-ball', pagePath: '/halloween' })).toBe('/halloween'))
  it('página estándar', () => expect(eventHref({ slug: 'vintage-pilates', pagePath: null })).toBe('/eventos/vintage-pilates'))
})

describe('partitionEvents', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  const ev = (slug: string, start: string, end: string) => ({ slug, startsAt: new Date(start), endsAt: new Date(end) })
  it('próximos ascendente y pasados descendente; uno en curso cuenta como próximo', () => {
    const r = partitionEvents([
      ev('pasado-viejo', '2026-09-01T00:00:00Z', '2026-09-01T03:00:00Z'),
      ev('lejano', '2026-12-10T00:00:00Z', '2026-12-10T03:00:00Z'),
      ev('en-curso', '2026-11-01T10:00:00Z', '2026-11-01T14:00:00Z'),
      ev('pasado-reciente', '2026-10-31T00:30:00Z', '2026-10-31T05:59:00Z'),
    ], now)
    expect(r.upcoming.map((e) => e.slug)).toEqual(['en-curso', 'lejano'])
    expect(r.past.map((e) => e.slug)).toEqual(['pasado-reciente', 'pasado-viejo'])
  })
})

describe('eventTheme', () => {
  it('villains', () => expect(eventTheme('villains')).toBe('villains'))
  it('cualquier otro → wellnest', () => expect(eventTheme('raro')).toBe('wellnest'))
})

describe('titleParts', () => {
  it('pone en cursiva la palabra más larga (la primera si empatan)', () => {
    expect(titleParts('The Villains Ball')).toEqual({ before: 'The ', accent: 'Villains', after: ' Ball' })
    expect(titleParts('Vintage Pilates')).toEqual({ before: '', accent: 'Vintage', after: ' Pilates' })
  })
  it('una sola palabra', () => expect(titleParts('Gala')).toEqual({ before: '', accent: 'Gala', after: '' }))
})

describe('morningAfterLine', () => {
  it('día siguiente al evento, en hora de El Salvador', () =>
    expect(morningAfterLine(new Date('2026-10-31T00:30:00Z'))).toBe('31 DE OCTUBRE · LA MAÑANA SIGUIENTE'))
})
