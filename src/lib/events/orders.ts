import { Prisma, type EventOrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EVENT_ORDER_HOLD_HOURS } from './config'
import { generateOrderCode, generateToken } from './codes'
import { normalizePhone } from './phone'
import type { CreateOrderInput } from './schemas'

type Tx = Prisma.TransactionClient

export function isOrderExpired(o: { status: EventOrderStatus; expiresAt: Date }, now: Date): boolean {
  return o.status === 'PENDING' && o.expiresAt.getTime() <= now.getTime()
}

export function hasCapacity(capacity: number | null, taken: number, requested: number): boolean {
  return capacity === null || taken + requested <= capacity
}

/** Entradas ocupadas: pedidos pagados + pendientes que no han vencido. */
export async function seatsTaken(db: Pick<Tx, 'eventOrder'>, eventId: string, now: Date): Promise<number> {
  const agg = await db.eventOrder.aggregate({
    where: { eventId, OR: [{ status: 'PAID' }, { status: 'PENDING', expiresAt: { gt: now } }] },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

export type CreateOrderResult =
  | { ok: true; accessToken: string; code: string; amountCents: number }
  | { ok: false; status: 400 | 404 | 409; error: string }

function isKnown(e: unknown, code: string): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code
}

function isCodeCollision(e: unknown): boolean {
  if (!isKnown(e, 'P2002')) return false
  const target = e.meta?.target
  return Array.isArray(target) ? target.includes('code') : String(target ?? '').includes('code')
}

export async function createEventOrder(slug: string, input: CreateOrderInput, now: Date = new Date()): Promise<CreateOrderResult> {
  const phone = normalizePhone(input.phone)
  if (!phone.ok) return { ok: false, status: 400, error: phone.error }

  const attempt = () =>
    prisma.$transaction(async (tx): Promise<CreateOrderResult> => {
      const event = await tx.event.findUnique({ where: { slug } })
      if (!event) return { ok: false, status: 404, error: 'Evento no encontrado' }
      if (!event.salesOpen || now.getTime() >= event.startsAt.getTime()) {
        return { ok: false, status: 409, error: 'La venta de entradas está cerrada' }
      }
      const taken = await seatsTaken(tx, event.id, now)
      if (!hasCapacity(event.capacity, taken, input.quantity)) {
        return { ok: false, status: 409, error: 'Las entradas se agotaron' }
      }
      const order = await tx.eventOrder.create({
        data: {
          eventId: event.id,
          code: generateOrderCode(),
          accessToken: generateToken(),
          buyerName: input.name.trim(),
          buyerEmail: input.email.trim().toLowerCase(),
          buyerPhone: phone.e164,
          quantity: input.quantity,
          amountCents: event.priceCents * input.quantity,
          marketingOptIn: input.marketingOptIn,
          expiresAt: new Date(now.getTime() + EVENT_ORDER_HOLD_HOURS * 3600 * 1000),
        },
      })
      return { ok: true, accessToken: order.accessToken, code: order.code, amountCents: order.amountCents }
    }, { isolationLevel: 'Serializable' })

  let serializationRetried = false
  for (let codeTries = 0; ; ) {
    try {
      return await attempt()
    } catch (e) {
      if (isCodeCollision(e) && ++codeTries < 5) continue
      if (isKnown(e, 'P2034') && !serializationRetried) {
        serializationRetried = true
        continue
      }
      throw e
    }
  }
}
