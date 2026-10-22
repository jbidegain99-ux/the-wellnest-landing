import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { eventTicket: { findUnique: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { extractTicketToken, checkInTicket, undoCheckIn } from './checkin'

const HEX = 'a'.repeat(32) + '0123456789abcdef'.repeat(2)
const NOW = new Date('2026-10-31T01:00:00Z')
const TICKET = {
  id: 't1', seq: 1, holderName: 'Ana Martínez', checkedInAt: null as Date | null,
  order: { code: 'HW-7K3P', quantity: 2, status: 'PAID', buyerName: 'Ana Martínez' },
}

describe('extractTicketToken', () => {
  it.each([
    `https://wellneststudio.net/entrada/${HEX}`,
    `https://wellneststudio.net/entrada/${HEX}/`,
    `https://wellneststudio.net/entrada/${HEX}?utm=1`,
    `http://localhost:3000/entrada/${HEX}`,
    HEX,
    `  ${HEX.toUpperCase()}  `,
  ])('acepta %s', (s) => expect(extractTicketToken(s)).toBe(HEX))
  it.each(['https://otro.com/x', 'hola', '', 'https://wellneststudio.net/entrada/123', `https://x.com/perfil/${HEX}`])(
    'rechaza %s', (s) => expect(extractTicketToken(s)).toBeNull())
})

describe('checkInTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.eventTicket.findUnique.mockResolvedValue({ ...TICKET })
    prismaMock.eventTicket.updateMany.mockResolvedValue({ count: 1 })
  })

  it('admite y marca atómicamente', async () => {
    const r = await checkInTicket({ token: HEX }, 'admin1', NOW)
    expect(r).toEqual({ kind: 'admitted', ticketId: 't1', holderLabel: 'Ana Martínez', label: 'HW-7K3P-1', seq: 1, quantity: 2, checkedInAt: NOW })
    expect(prismaMock.eventTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', checkedInAt: null }, data: { checkedInAt: NOW, checkedInById: 'admin1' },
    })
  })

  it('doble escaneo: el segundo ve "ya ingresó" con la hora del primero', async () => {
    const first = new Date('2026-10-31T00:42:00Z')
    prismaMock.eventTicket.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.eventTicket.findUnique
      .mockResolvedValueOnce({ ...TICKET })
      .mockResolvedValueOnce({ checkedInAt: first })
    const r = await checkInTicket({ token: HEX }, 'admin2', NOW)
    expect(r).toMatchObject({ kind: 'already', ticketId: 't1', checkedInAt: first, holderLabel: 'Ana Martínez' })
  })

  it('anulado → cancelled sin marcar', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ ...TICKET, order: { ...TICKET.order, status: 'CANCELLED' } })
    expect((await checkInTicket({ token: HEX }, 'a', NOW)).kind).toBe('cancelled')
    expect(prismaMock.eventTicket.updateMany).not.toHaveBeenCalled()
  })

  it('desconocido → unknown', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue(null)
    expect(await checkInTicket({ ticketId: 'nope' }, 'a', NOW)).toEqual({ kind: 'unknown' })
  })

  it('sin titular: "Invitado de" el comprador', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ ...TICKET, seq: 2, holderName: null })
    expect((await checkInTicket({ token: HEX }, 'a', NOW)).holderLabel).toBe('Invitado de Ana Martínez')
  })
})

describe('undoCheckIn', () => {
  beforeEach(() => vi.clearAllMocks())
  it('dentro de 30 s → deshace', async () => {
    prismaMock.eventTicket.updateMany.mockResolvedValue({ count: 1 })
    expect(await undoCheckIn('t1', NOW)).toBe(true)
    expect(prismaMock.eventTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', checkedInAt: { gte: new Date(NOW.getTime() - 30_000) } },
      data: { checkedInAt: null, checkedInById: null },
    })
  })
  it('a los 31 s ya no', async () => {
    prismaMock.eventTicket.updateMany.mockResolvedValue({ count: 0 })
    expect(await undoCheckIn('t1', NOW)).toBe(false)
  })
})
