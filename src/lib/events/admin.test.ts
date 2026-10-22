import { describe, it, expect } from 'vitest'
import { adminOrdersWhere } from './admin'

const NOW = new Date('2026-10-22T15:00:00Z')

describe('adminOrdersWhere', () => {
  it('pendientes = PENDING vigentes', () =>
    expect(adminOrdersWhere('e1', 'pendientes', '', NOW)).toEqual({ eventId: 'e1', AND: [{ status: 'PENDING', expiresAt: { gt: NOW } }] }))
  it('pagados', () => expect(adminOrdersWhere('e1', 'pagados', '', NOW)).toEqual({ eventId: 'e1', AND: [{ status: 'PAID' }] }))
  it('otros = cancelados + pendientes vencidos', () =>
    expect(adminOrdersWhere('e1', 'otros', '', NOW)).toEqual({
      eventId: 'e1', AND: [{ OR: [{ status: 'CANCELLED' }, { status: 'PENDING', expiresAt: { lte: NOW } }] }],
    }))
  it('búsqueda por código, nombre, correo o dígitos del teléfono', () => {
    const w = adminOrdersWhere('e1', 'pagados', ' hw-7k ', NOW)
    expect(w.AND).toContainEqual({
      OR: [
        { code: { contains: 'HW-7K' } },
        { buyerName: { contains: 'hw-7k', mode: 'insensitive' } },
        { buyerEmail: { contains: 'hw-7k', mode: 'insensitive' } },
        { buyerPhone: { contains: '7' } },
      ],
    })
  })
  it('sin dígitos no filtra por teléfono', () => {
    const w = adminOrdersWhere('e1', 'pagados', 'ana', NOW)
    const or = (w.AND as Array<{ OR?: unknown[] }>)[1].OR ?? []
    expect(or).toHaveLength(3)
  })
})
