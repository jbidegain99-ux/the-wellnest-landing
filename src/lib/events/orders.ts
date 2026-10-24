import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { generateOrderCode, generateToken, ticketLabel } from './codes'
import { findOrCreateUserByEmail } from './accounts'
import { buyerTicketsMessage, waLink, ticketUrl } from './whatsapp'
import { formatInTimeZone } from 'date-fns-tz'
import { normalizePhone } from './phone'
import type { CreateOrderInput, ClaimTicketInput } from './schemas'
import type { EmailEvent } from './emails'

type Tx = Prisma.TransactionClient

export function hasCapacity(capacity: number | null, taken: number, requested: number): boolean {
  return capacity === null || taken + requested <= capacity
}

/**
 * Entradas ocupadas: pedidos pagados + pendientes. Los pendientes no vencen
 * (una transferencia puede tardar días): siguen apartados hasta que un admin
 * los confirme o los anule.
 */
export async function seatsTaken(db: Pick<Tx, 'eventOrder'>, eventId: string): Promise<number> {
  const agg = await db.eventOrder.aggregate({
    where: { eventId, status: { in: ['PAID', 'PENDING'] } },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

export type CreateOrderResult =
  | { ok: true; accessToken: string; code: string; amountCents: number; event: EmailEvent }
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
      if (!event.isActive || !event.ticketsEnabled || !event.salesOpen || now.getTime() >= event.startsAt.getTime()) {
        return { ok: false, status: 409, error: 'La venta de entradas está cerrada' }
      }
      const taken = await seatsTaken(tx, event.id)
      if (!hasCapacity(event.capacity, taken, input.quantity)) {
        return { ok: false, status: 409, error: 'Las entradas se agotaron' }
      }
      const order = await tx.eventOrder.create({
        data: {
          eventId: event.id,
          code: generateOrderCode(event.codePrefix),
          accessToken: generateToken(),
          buyerName: input.name.trim(),
          buyerEmail: input.email.trim().toLowerCase(),
          buyerPhone: phone.e164,
          quantity: input.quantity,
          amountCents: event.priceCents * input.quantity,
          marketingOptIn: input.marketingOptIn,
          // Columna heredada (NOT NULL): ya no vence el pedido, solo guarda el fin del evento.
          expiresAt: event.endsAt,
        },
      })
      return {
        ok: true, accessToken: order.accessToken, code: order.code, amountCents: order.amountCents,
        event: { name: event.name, startsAt: event.startsAt, venue: event.venue, thanksMessage: event.thanksMessage },
      }
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

export type ConfirmResult =
  | {
      ok: true
      tickets: { seq: number; token: string }[]
      overCapacity: boolean
      whatsappUrl: string
      order: { code: string; buyerName: string; buyerEmail: string }
      event: EmailEvent
    }
  | { ok: false; status: 404 | 409; error: string }

/**
 * Confirma el pago (después de verlo en el banco): PENDING → PAID atómico,
 * crea las entradas (la 1 queda del comprador) y su cuenta.
 */
export async function confirmEventOrder(orderId: string, adminId: string, now: Date = new Date()): Promise<ConfirmResult> {
  return prisma.$transaction(async (tx): Promise<ConfirmResult> => {
    const order = await tx.eventOrder.findUnique({ where: { id: orderId }, include: { event: true } })
    if (!order) return { ok: false, status: 404, error: 'Pedido no encontrado' }
    if (order.status === 'CANCELLED') return { ok: false, status: 409, error: 'Este pedido fue anulado' }

    const claim = await tx.eventOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: now, confirmedById: adminId },
    })
    if (claim.count === 0) return { ok: false, status: 409, error: 'Ya estaba confirmado' }

    const taken = await seatsTaken(tx, order.eventId)
    const overCapacity = order.event.capacity !== null && taken > order.event.capacity

    const user = await findOrCreateUserByEmail(tx, { name: order.buyerName, email: order.buyerEmail, phone: order.buyerPhone })

    const tickets = Array.from({ length: order.quantity }, (_, i) => {
      const seq = i + 1
      const base = { orderId: order.id, eventId: order.eventId, seq, token: generateToken() }
      return seq === 1
        ? {
            ...base,
            holderName: order.buyerName,
            holderEmail: order.buyerEmail,
            holderPhone: order.buyerPhone,
            holderUserId: user.id,
            marketingOptIn: order.marketingOptIn,
            claimedAt: now,
          }
        : base
    })
    await tx.eventTicket.createMany({ data: tickets })
    await tx.eventOrder.update({ where: { id: order.id }, data: { buyerUserId: user.id } })

    const whatsappUrl = waLink(
      buyerTicketsMessage({ buyerName: order.buyerName.split(' ')[0] ?? order.buyerName, firstTicketToken: tickets[0].token, quantity: order.quantity, event: order.event }),
      order.buyerPhone
    )
    return {
      ok: true,
      tickets: tickets.map((t) => ({ seq: t.seq, token: t.token })),
      overCapacity,
      whatsappUrl,
      order: { code: order.code, buyerName: order.buyerName, buyerEmail: order.buyerEmail },
      event: { name: order.event.name, startsAt: order.event.startsAt, venue: order.event.venue, thanksMessage: order.event.thanksMessage },
    }
  })
}

export async function cancelEventOrder(
  orderId: string,
  adminId: string,
  note: string | null,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const order = await prisma.eventOrder.findUnique({ where: { id: orderId }, select: { status: true } })
  if (!order) return { ok: false, status: 404, error: 'Pedido no encontrado' }
  if (order.status === 'CANCELLED') return { ok: false, status: 409, error: 'El pedido ya estaba anulado' }
  const trimmed = note?.trim() || null
  if (order.status === 'PAID' && !trimmed) return { ok: false, status: 400, error: 'Escribí el motivo de la anulación' }

  const r = await prisma.eventOrder.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: 'CANCELLED', cancelledAt: now, adminNote: trimmed },
  })
  if (r.count === 0) return { ok: false, status: 409, error: 'El pedido cambió mientras tanto. Recargá la página.' }
  console.log(`[EVENTO] Pedido ${orderId} anulado por ${adminId} (estaba ${order.status})`)
  return { ok: true }
}

export type PaidOrderCsvRow = {
  code: string; buyerName: string; buyerEmail: string; buyerPhone: string
  quantity: number; amountCents: number; paidAt: Date; confirmedBy: string
}

function csvCell(v: string, opts: { allowLeadingPlus?: boolean } = {}): string {
  // Excel ejecuta como fórmula lo que empieza con = + - @ (los teléfonos E.164 sí empiezan con +)
  const risky = /^[=\-@\t\r]/.test(v) || (!opts.allowLeadingPlus && v.startsWith('+'))
  const safe = risky ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV de pedidos pagados para la conciliación bancaria (Excel-friendly: BOM + CRLF). */
export function buildPaidOrdersCsv(rows: PaidOrderCsvRow[]): string {
  const header = 'codigo,comprador,correo,telefono,cantidad,monto,pagado_el,confirmado_por'
  const lines = rows.map((r) =>
    [
      csvCell(r.code), csvCell(r.buyerName), csvCell(r.buyerEmail), csvCell(r.buyerPhone, { allowLeadingPlus: /^\+\d+$/.test(r.buyerPhone) }),
      String(r.quantity), (r.amountCents / 100).toFixed(2),
      formatInTimeZone(r.paidAt, 'America/El_Salvador', 'yyyy-MM-dd HH:mm'), csvCell(r.confirmedBy),
    ].join(',')
  )
  return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n'
}

export type OrderView = {
  event: { name: string; slug: string; startsAt: Date; venue: string; theme: string; imageUrl: string | null }
  state: 'pending' | 'paid' | 'cancelled'
  code: string
  quantity: number
  amountCents: number
  tickets: { label: string; url: string }[]
}

/** Lo que ve el comprador en /halloween/pedido/[accessToken]. */
export async function getOrderView(accessToken: string): Promise<OrderView | null> {
  const order = await prisma.eventOrder.findUnique({
    where: { accessToken },
    include: {
      tickets: { select: { seq: true, token: true } },
      event: { select: { name: true, slug: true, startsAt: true, venue: true, theme: true, imageUrl: true } },
    },
  })
  if (!order) return null
  const state: OrderView['state'] =
    order.status === 'PAID' ? 'paid' : order.status === 'CANCELLED' ? 'cancelled' : 'pending'
  const tickets =
    state === 'paid'
      ? [...order.tickets].sort((a, b) => a.seq - b.seq).map((t) => ({ label: ticketLabel(order.code, t.seq), url: ticketUrl(t.token) }))
      : []
  return { event: order.event, state, code: order.code, quantity: order.quantity, amountCents: order.amountCents, tickets }
}

export type ClaimResult = { ok: true } | { ok: false; status: 400 | 404 | 409; error: string }

/** Un acompañante deja sus datos en su invitación (seq > 1) para recibir su QR. */
export async function claimTicket(token: string, input: ClaimTicketInput, now: Date = new Date()): Promise<ClaimResult> {
  const phone = normalizePhone(input.phone)
  if (!phone.ok) return { ok: false, status: 400, error: phone.error }

  const ticket = await prisma.eventTicket.findUnique({
    where: { token },
    select: { id: true, claimedAt: true, order: { select: { status: true } } },
  })
  if (!ticket || ticket.order.status !== 'PAID') return { ok: false, status: 404, error: 'Invitación no encontrada' }
  const taken: ClaimResult = { ok: false, status: 409, error: 'Esta invitación ya fue reclamada' }
  if (ticket.claimedAt) return taken

  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  return prisma.$transaction(async (tx): Promise<ClaimResult> => {
    const user = await findOrCreateUserByEmail(tx, { name, email, phone: phone.e164 })
    const r = await tx.eventTicket.updateMany({
      where: { id: ticket.id, claimedAt: null },
      data: { holderName: name, holderEmail: email, holderPhone: phone.e164, holderUserId: user.id, marketingOptIn: input.marketingOptIn, claimedAt: now },
    })
    return r.count === 1 ? { ok: true } : taken
  })
}
