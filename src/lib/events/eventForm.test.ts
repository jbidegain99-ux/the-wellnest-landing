import { describe, it, expect } from 'vitest'
import { eventFormInput, eventFormToData, slugify, localInputFromDate } from './eventForm'

const VALID = {
  name: 'Vintage Pilates', slug: 'vintage-pilates', startsAtLocal: '2026-11-14T09:00', endsAtLocal: '2026-11-14T11:00',
  venue: 'Wellnest Studio', priceDollars: 15, capacity: 20, summary: 'Pilates con música de los 60', description: '',
  imageUrl: '', codePrefix: 'VP-', theme: 'wellnest', ticketsEnabled: true, isActive: false, salesOpen: true,
  thanksMessage: '', pagePath: '',
}

describe('slugify', () => {
  it('quita tildes, espacios y símbolos', () => expect(slugify('  Vintage Pilátes: ¡Edición #2! ')).toBe('vintage-pilates-edicion-2'))
})

describe('eventFormInput', () => {
  it('acepta un evento válido', () => expect(eventFormInput.safeParse(VALID).success).toBe(true))
  it('fin antes del inicio → error en endsAtLocal', () => {
    const r = eventFormInput.safeParse({ ...VALID, endsAtLocal: '2026-11-14T08:00' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.errors[0]).toMatchObject({ path: ['endsAtLocal'], message: 'El fin tiene que ser después del inicio' })
  })
  it.each(['Vintage Pilates', 'a', 'pedido', 'nuevo', 'checkin', 'lista', 'con_guion_bajo'])('rechaza slug %s', (slug) =>
    expect(eventFormInput.safeParse({ ...VALID, slug }).success).toBe(false))
  it.each(['VP', 'vp-', 'VINTAGE-', 'V1-'])('rechaza prefijo %s', (codePrefix) =>
    expect(eventFormInput.safeParse({ ...VALID, codePrefix }).success).toBe(false))
  it.each(['/eventos/x.jpg', 'https://res.cloudinary.com/x.jpg', ''])('acepta imagen %s', (imageUrl) =>
    expect(eventFormInput.safeParse({ ...VALID, imageUrl }).success).toBe(true))
  it.each(['http://x.com/a.jpg', 'javascript:alert(1)', 'x.jpg'])('rechaza imagen %s', (imageUrl) =>
    expect(eventFormInput.safeParse({ ...VALID, imageUrl }).success).toBe(false))
  it('rechaza pagePath que no empieza con /', () => expect(eventFormInput.safeParse({ ...VALID, pagePath: 'https://x.com' }).success).toBe(false))
  it('rechaza pagePath protocol-relative (//host)', () => expect(eventFormInput.safeParse({ ...VALID, pagePath: '//3627732462' }).success).toBe(false))
})

describe('eventFormToData', () => {
  it('convierte hora local de El Salvador a UTC, dólares a centavos y vacíos a null', () => {
    const d = eventFormToData(eventFormInput.parse({ ...VALID, priceDollars: 12.5 }))
    expect(d).toMatchObject({
      name: 'Vintage Pilates', slug: 'vintage-pilates', priceCents: 1250, capacity: 20,
      startsAt: new Date('2026-11-14T15:00:00Z'), endsAt: new Date('2026-11-14T17:00:00Z'),
      imageUrl: null, pagePath: null, thanksMessage: null, codePrefix: 'VP-', theme: 'wellnest',
    })
  })
  it('round-trip de la fecha para el formulario', () =>
    expect(localInputFromDate(new Date('2026-10-31T00:30:00Z'))).toBe('2026-10-30T18:30'))
})
