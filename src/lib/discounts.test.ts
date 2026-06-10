import { describe, it, expect } from 'vitest'
import { normalizeDiscountCode } from './discounts'

describe('normalizeDiscountCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeDiscountCode('telusana15')).toBe('TELUSANA15')
  })

  it('removes trailing whitespace (common when pasting from WhatsApp)', () => {
    expect(normalizeDiscountCode('TELUSANA15 ')).toBe('TELUSANA15')
  })

  it('removes leading whitespace', () => {
    expect(normalizeDiscountCode(' TELUSANA15')).toBe('TELUSANA15')
  })

  it('removes trailing newline', () => {
    expect(normalizeDiscountCode('TELUSANA15\n')).toBe('TELUSANA15')
  })

  it('handles combined casing and whitespace', () => {
    expect(normalizeDiscountCode('  telusana15\t')).toBe('TELUSANA15')
  })

  it('keeps an already-normalized code unchanged', () => {
    expect(normalizeDiscountCode('TELUSANA15')).toBe('TELUSANA15')
  })
})
