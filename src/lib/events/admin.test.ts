import { describe, it, expect } from 'vitest'
import { adminOrdersWhere } from './admin'

describe('adminOrdersWhere', () => {
  it('pendientes = todos los PENDING (no vencen)', () =>
    expect(adminOrdersWhere('e1', 'pendientes', '')).toEqual({ eventId: 'e1', AND: [{ status: 'PENDING' }] }))
  it('pagados', () => expect(adminOrdersWhere('e1', 'pagados', '')).toEqual({ eventId: 'e1', AND: [{ status: 'PAID' }] }))
  it('otros = anulados', () =>
    expect(adminOrdersWhere('e1', 'otros', '')).toEqual({ eventId: 'e1', AND: [{ status: 'CANCELLED' }] }))
  it('búsqueda por código: no mezcla teléfonos por los dígitos del código', () => {
    const w = adminOrdersWhere('e1', 'pagados', ' hw-7k3p ')
    expect(w.AND).toContainEqual({
      OR: [
        { code: { contains: 'HW-7K3P' } },
        { buyerName: { contains: 'hw-7k3p', mode: 'insensitive' } },
        { buyerEmail: { contains: 'hw-7k3p', mode: 'insensitive' } },
      ],
    })
  })
  it('búsqueda por teléfono con 4+ dígitos', () => {
    const w = adminOrdersWhere('e1', 'pagados', '7792-3957')
    const or = (w.AND as Array<{ OR?: unknown[] }>)[1].OR ?? []
    expect(or).toContainEqual({ buyerPhone: { contains: '77923957' } })
  })
  it('sin dígitos no filtra por teléfono', () => {
    const w = adminOrdersWhere('e1', 'pagados', 'ana')
    const or = (w.AND as Array<{ OR?: unknown[] }>)[1].OR ?? []
    expect(or).toHaveLength(3)
  })
})
