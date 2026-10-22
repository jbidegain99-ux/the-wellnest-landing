import { describe, it, expect } from 'vitest'
import { normalizePhone, waNumber } from './phone'

describe('normalizePhone', () => {
  it.each(['7792-3957', '77923957', '+503 7792 3957', '503 77923957', '(503) 7792-3957', ' 7792 3957 '])(
    'normaliza %s', (raw) => expect(normalizePhone(raw)).toEqual({ ok: true, e164: '+50377923957' }))
  it('acepta 2xxx y 6xxx de SV', () => {
    expect(normalizePhone('2222-3333')).toEqual({ ok: true, e164: '+50322223333' })
    expect(normalizePhone('6123 4567')).toEqual({ ok: true, e164: '+50361234567' })
  })
  it('respeta números extranjeros con +', () =>
    expect(normalizePhone('+1 (305) 555-0101')).toEqual({ ok: true, e164: '+13055550101' }))
  it.each(['1234', '9999-9999', 'abc', '', '+12'])('rechaza %s', (raw) => {
    const r = normalizePhone(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Escribí tu WhatsApp con código de país si no es de El Salvador')
  })
  it('waNumber quita el +', () => expect(waNumber('+50377923957')).toBe('50377923957'))
})
