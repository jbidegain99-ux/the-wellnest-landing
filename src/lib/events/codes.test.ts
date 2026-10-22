import { describe, it, expect } from 'vitest'
import { generateOrderCode, generateToken, ticketLabel } from './codes'

describe('codes', () => {
  it('genera prefijo del evento + 4 caracteres del alfabeto sin ambiguos', () => {
    for (let i = 0; i < 200; i++) expect(generateOrderCode('HW-')).toMatch(/^HW-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
    expect(generateOrderCode('VP-')).toMatch(/^VP-[A-Z2-9]{4}$/)
  })
  it('token de 64 hex', () => expect(generateToken()).toMatch(/^[0-9a-f]{64}$/))
  it('tokens distintos', () => expect(generateToken()).not.toBe(generateToken()))
  it('etiqueta de entrada', () => expect(ticketLabel('HW-7K3P', 2)).toBe('HW-7K3P-2'))
})
