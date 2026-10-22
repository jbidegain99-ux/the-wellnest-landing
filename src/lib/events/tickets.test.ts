import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { eventTicket: { findUnique: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { getTicketPage } from './tickets'

const NOW = new Date('2026-10-25T15:00:00Z')
const EVENT = { name: 'The Villains Ball', startsAt: new Date('2026-10-31T00:30:00Z'), endsAt: new Date('2026-10-31T05:59:00Z'), venue: 'Plaza' }
const ORDER = {
  code: 'HW-7K3P', quantity: 3, status: 'PAID', buyerName: 'Ana Martínez',
  tickets: [
    { seq: 1, token: 'ta', holderName: 'Ana Martínez', claimedAt: NOW },
    { seq: 3, token: 'tc', holderName: null, claimedAt: null },
    { seq: 2, token: 'tb', holderName: 'Luis Pérez', claimedAt: NOW },
  ],
}

describe('getTicketPage', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NEXTAUTH_URL = 'https://wellneststudio.net' })

  it('inexistente → null', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue(null)
    expect(await getTicketPage('x', NOW)).toBeNull()
  })

  it('entrada 1 de un pedido de 3: lista las otras para pasarlas', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ seq: 1, token: 'ta', holderName: 'Ana Martínez', claimedAt: NOW, checkedInAt: null, event: EVENT, order: ORDER })
    const p = await getTicketPage('ta', NOW)
    expect(p).toMatchObject({ phase: 'ready', seq: 1, quantity: 3, label: 'HW-7K3P-1', holderLabel: 'Ana Martínez', buyerFirstName: 'Ana', url: 'https://wellneststudio.net/entrada/ta' })
    expect(p?.others).toEqual([
      { seq: 2, label: 'HW-7K3P-2', holderName: 'Luis Pérez', shareUrl: expect.stringContaining('https://wa.me/?text=') },
      { seq: 3, label: 'HW-7K3P-3', holderName: null, shareUrl: expect.stringContaining(encodeURIComponent('/entrada/tc')) },
    ])
  })

  it('entrada 2: no ve las demás; sin titular dice "Invitado de"', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ seq: 3, token: 'tc', holderName: null, claimedAt: null, checkedInAt: null, event: EVENT, order: ORDER })
    const p = await getTicketPage('tc', NOW)
    expect(p).toMatchObject({ phase: 'unclaimed', seq: 3, holderLabel: 'Invitado de Ana Martínez', others: [] })
  })
})
