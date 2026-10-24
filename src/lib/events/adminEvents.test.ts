import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    event: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    eventOrder: { groupBy: vi.fn() },
    eventTicket: { groupBy: vi.fn() },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { createEvent, updateEvent, setEventFlags, listEventsWithCounts } from './adminEvents'
import type { EventData } from './eventForm'

const DATA: EventData = {
  name: 'Vintage Pilates', slug: 'vintage-pilates', startsAt: new Date('2026-11-14T15:00:00Z'), endsAt: new Date('2026-11-14T17:00:00Z'),
  venue: 'Wellnest', priceCents: 1500, capacity: 20, summary: '', description: '', imageUrl: null, codePrefix: 'VP-', theme: 'wellnest',
  ticketsEnabled: true, isActive: false, salesOpen: true, thanksMessage: null, pagePath: null,
}
const dup = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't', meta: { target: ['slug'] } })
const missing = () => new Prisma.PrismaClientKnownRequestError('nf', { code: 'P2025', clientVersion: 't' })

describe('adminEvents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea', async () => {
    prismaMock.event.create.mockResolvedValue({ id: 'e1', slug: 'vintage-pilates' })
    expect(await createEvent(DATA)).toEqual({ ok: true, id: 'e1', slug: 'vintage-pilates' })
    expect(prismaMock.event.create).toHaveBeenCalledWith({ data: DATA, select: { id: true, slug: true } })
  })
  it('slug repetido → 409', async () => {
    prismaMock.event.create.mockRejectedValue(dup())
    expect(await createEvent(DATA)).toEqual({ ok: false, status: 409, error: 'Ya existe un evento con ese identificador' })
  })
  it('editar inexistente → 404', async () => {
    prismaMock.event.update.mockRejectedValue(missing())
    expect(await updateEvent('x', DATA)).toEqual({ ok: false, status: 404, error: 'Evento no encontrado' })
  })
  it('editar no cambia el slug', async () => {
    prismaMock.event.update.mockResolvedValue({ id: 'e1' })
    await updateEvent('e1', { ...DATA, slug: 'otro' })
    expect(prismaMock.event.update.mock.calls[0][0].data.slug).toBeUndefined()
  })
  it('interruptores: solo cambia lo enviado', async () => {
    prismaMock.event.update.mockResolvedValue({ id: 'e1' })
    expect(await setEventFlags('e1', { isActive: true })).toEqual({ ok: true })
    expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { isActive: true }, select: { id: true } })
  })
  it('lista con conteos de entradas pagadas, pendientes y adentro', async () => {
    const d = { startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2026-11-01T03:00:00Z') }
    prismaMock.event.findMany.mockResolvedValue([{ id: 'e1', slug: 'a', name: 'A', ...d }, { id: 'e2', slug: 'b', name: 'B', ...d }])
    prismaMock.eventOrder.groupBy.mockResolvedValue([
      { eventId: 'e1', status: 'PAID', _sum: { quantity: 5 } },
      { eventId: 'e1', status: 'PENDING', _sum: { quantity: 2 } },
    ])
    prismaMock.eventTicket.groupBy.mockResolvedValue([{ eventId: 'e1', _count: { _all: 3 } }])
    const rows = await listEventsWithCounts()
    expect(prismaMock.eventOrder.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { in: ['PAID', 'PENDING'] } } }))
    expect(rows).toEqual([
      expect.objectContaining({ id: 'e1', paidTickets: 5, pendingTickets: 2, checkedIn: 3 }),
      expect.objectContaining({ id: 'e2', paidTickets: 0, pendingTickets: 0, checkedIn: 0 }),
    ])
  })
})
