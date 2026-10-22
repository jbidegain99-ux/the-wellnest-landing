import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    event: { findUnique: vi.fn() },
    eventOrder: { aggregate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    eventTicket: { createMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  }
  const prismaMock = {
    ...txMock,
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  }
  return { txMock, prismaMock }
})
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { isOrderExpired, hasCapacity, createEventOrder } from './orders'

const NOW = new Date('2026-10-22T15:00:00Z')
const EVENT = {
  id: 'evt1', slug: 'villains-ball', name: 'The Villains Ball', priceCents: 1000, capacity: null as number | null,
  salesOpen: true, startsAt: new Date('2026-10-31T00:30:00Z'), endsAt: new Date('2026-10-31T05:59:00Z'), venue: 'x',
}
const INPUT = { name: 'Ana Martínez', phone: '7792-3957', email: 'Ana@Gmail.com', quantity: 2, marketingOptIn: true }

function knownError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta: target ? { target } : undefined })
}

describe('isOrderExpired', () => {
  it('PENDING vencido', () => expect(isOrderExpired({ status: 'PENDING', expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe(true))
  it('PENDING vigente', () => expect(isOrderExpired({ status: 'PENDING', expiresAt: new Date(NOW.getTime() + 1) }, NOW)).toBe(false))
  it('PAID nunca vence', () => expect(isOrderExpired({ status: 'PAID', expiresAt: new Date(0) }, NOW)).toBe(false))
})

describe('hasCapacity', () => {
  it('sin tope', () => expect(hasCapacity(null, 999, 6)).toBe(true))
  it('se pasa', () => expect(hasCapacity(10, 8, 3)).toBe(false))
  it('justo', () => expect(hasCapacity(10, 7, 3)).toBe(true))
})

describe('createEventOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txMock.event.findUnique.mockResolvedValue({ ...EVENT })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 0 } })
    txMock.eventOrder.create.mockImplementation(async ({ data }: { data: { code: string; accessToken: string } }) => data)
  })

  it('evento inexistente → 404', async () => {
    txMock.event.findUnique.mockResolvedValue(null)
    expect(await createEventOrder('nope', INPUT, NOW)).toEqual({ ok: false, status: 404, error: 'Evento no encontrado' })
  })

  it('venta cerrada → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, salesOpen: false })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('ya empezó el evento → 409', async () => {
    const r = await createEventOrder('villains-ball', INPUT, new Date('2026-10-31T00:30:00Z'))
    expect(r).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('sin cupo → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, capacity: 10 })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 9 } })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'Las entradas se agotaron' })
  })

  it('cuenta PAID + PENDING vigentes para el cupo', async () => {
    await createEventOrder('villains-ball', INPUT, NOW)
    expect(txMock.eventOrder.aggregate).toHaveBeenCalledWith({
      where: { eventId: 'evt1', OR: [{ status: 'PAID' }, { status: 'PENDING', expiresAt: { gt: NOW } }] },
      _sum: { quantity: true },
    })
  })

  it('teléfono inválido → 400 sin tocar la BD', async () => {
    const r = await createEventOrder('villains-ball', { ...INPUT, phone: '1234' }, NOW)
    expect(r).toEqual({ ok: false, status: 400, error: 'Escribí tu WhatsApp con código de país si no es de El Salvador' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('feliz: crea PENDING con monto, vencimiento 24h, correo y teléfono normalizados', async () => {
    const r = await createEventOrder('villains-ball', INPUT, NOW)
    expect(r.ok).toBe(true)
    const data = txMock.eventOrder.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      eventId: 'evt1', buyerName: 'Ana Martínez', buyerEmail: 'ana@gmail.com', buyerPhone: '+50377923957',
      quantity: 2, amountCents: 2000, marketingOptIn: true, expiresAt: new Date('2026-10-23T15:00:00Z'),
    })
    expect(data.code).toMatch(/^HW-[A-Z2-9]{4}$/)
    expect(data.accessToken).toMatch(/^[0-9a-f]{64}$/)
    if (r.ok) expect(r).toEqual({ ok: true, accessToken: data.accessToken, code: data.code, amountCents: 2000 })
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })

  it('reintenta si choca el código único', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(knownError('P2002', ['code']))
      .mockImplementationOnce(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
    const r = await createEventOrder('villains-ball', INPUT, NOW)
    expect(r.ok).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('reintenta una vez por conflicto de serialización y luego propaga', async () => {
    prismaMock.$transaction.mockRejectedValue(knownError('P2034'))
    await expect(createEventOrder('villains-ball', INPUT, NOW)).rejects.toThrow('boom')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
    prismaMock.$transaction.mockReset()
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
  })
})
