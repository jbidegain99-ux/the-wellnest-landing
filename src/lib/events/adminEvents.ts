import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { EventData } from './eventForm'

type Fail = { ok: false; status: 404 | 409; error: string }

function mapError(e: unknown): Fail {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return { ok: false, status: 409, error: 'Ya existe un evento con ese identificador' }
    if (e.code === 'P2025') return { ok: false, status: 404, error: 'Evento no encontrado' }
  }
  throw e
}

export async function createEvent(data: EventData): Promise<{ ok: true; id: string; slug: string } | Fail> {
  try {
    const e = await prisma.event.create({ data, select: { id: true, slug: true } })
    return { ok: true, id: e.id, slug: e.slug }
  } catch (e) {
    return mapError(e)
  }
}

export async function updateEvent(id: string, data: EventData): Promise<{ ok: true } | Fail> {
  // El slug no cambia después de crear: lo usan los enlaces y /halloween
  const { slug: _slug, ...rest } = data
  void _slug
  try {
    await prisma.event.update({ where: { id }, data: rest, select: { id: true } })
    return { ok: true }
  } catch (e) {
    return mapError(e)
  }
}

export type EventFlags = { isActive?: boolean; salesOpen?: boolean }

/** Interruptores del admin: "Visible en el sitio" y "Venta abierta". */
export async function setEventFlags(id: string, flags: EventFlags): Promise<{ ok: true } | Fail> {
  const data: EventFlags = {}
  if (typeof flags.isActive === 'boolean') data.isActive = flags.isActive
  if (typeof flags.salesOpen === 'boolean') data.salesOpen = flags.salesOpen
  try {
    await prisma.event.update({ where: { id }, data, select: { id: true } })
    return { ok: true }
  } catch (e) {
    return mapError(e)
  }
}

export type AdminEventRow = {
  id: string; slug: string; name: string; startsAt: string; endsAt: string; venue: string; priceCents: number
  capacity: number | null; isActive: boolean; salesOpen: boolean; ticketsEnabled: boolean; pagePath: string | null
  paidTickets: number; pendingTickets: number; checkedIn: number
}

export async function listEventsWithCounts(): Promise<AdminEventRow[]> {
  const [events, orderSums, inside] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: 'desc' } }),
    prisma.eventOrder.groupBy({
      by: ['eventId', 'status'],
      where: { status: { in: ['PAID', 'PENDING'] } },
      _sum: { quantity: true },
    }),
    prisma.eventTicket.groupBy({
      by: ['eventId'],
      where: { checkedInAt: { not: null }, order: { status: 'PAID' } },
      _count: { _all: true },
    }),
  ])
  const sum = (eventId: string, status: string) =>
    orderSums.find((r) => r.eventId === eventId && r.status === status)?._sum.quantity ?? 0
  return events.map((e) => ({
    id: e.id, slug: e.slug, name: e.name, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), venue: e.venue,
    priceCents: e.priceCents, capacity: e.capacity, isActive: e.isActive, salesOpen: e.salesOpen, ticketsEnabled: e.ticketsEnabled,
    pagePath: e.pagePath,
    paidTickets: sum(e.id, 'PAID'),
    pendingTickets: sum(e.id, 'PENDING'),
    checkedIn: inside.find((r) => r.eventId === e.id)?._count._all ?? 0,
  }))
}
