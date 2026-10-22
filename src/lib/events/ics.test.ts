import { describe, it, expect } from 'vitest'
import { buildEventIcs } from './ics'

describe('buildEventIcs', () => {
  const ics = buildEventIcs({
    name: 'The Villains Ball', startsAt: new Date('2026-10-31T00:30:00Z'), endsAt: new Date('2026-10-31T05:59:00Z'),
    venue: 'Plaza Presidente · Nivel 3, San Salvador', url: 'https://x/entrada/t',
  })
  it('es un VCALENDAR con fechas UTC', () => {
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261031T003000Z')
    expect(ics).toContain('DTEND:20261031T055900Z')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })
  it('usa CRLF', () => expect(ics.split('\r\n').length).toBeGreaterThan(5))
  it('escapa comas', () => expect(ics).toContain('LOCATION:Plaza Presidente · Nivel 3\\, San Salvador'))
})
