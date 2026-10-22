import { prisma } from '@/lib/prisma'
import { ticketLabel } from './codes'

const TOKEN_RE = /^[0-9a-f]{64}$/

/**
 * Token de una entrada a partir de lo que leyó el escáner: los 64 hex sueltos
 * o una URL cuyo path termina en /entrada/<token>. Cualquier otra cosa → null.
 */
export function extractTicketToken(scanned: string): string | null {
  const s = scanned.trim()
  if (TOKEN_RE.test(s.toLowerCase())) return s.toLowerCase()
  let path: string
  try {
    path = new URL(s).pathname
  } catch {
    return null
  }
  const m = /\/entrada\/([0-9a-fA-F]{64})\/?$/.exec(path)
  return m ? m[1].toLowerCase() : null
}

export type CheckInResult = {
  kind: 'admitted' | 'already' | 'unknown' | 'cancelled'
  ticketId?: string
  holderLabel?: string
  label?: string
  seq?: number
  quantity?: number
  checkedInAt?: Date
}

/** Check-in atómico: solo un escaneo gana aunque dos celulares lean el mismo QR. */
export async function checkInTicket(
  ref: { token: string } | { ticketId: string },
  adminId: string,
  now: Date = new Date()
): Promise<CheckInResult> {
  const t = await prisma.eventTicket.findUnique({
    where: 'token' in ref ? { token: ref.token } : { id: ref.ticketId },
    select: {
      id: true, seq: true, holderName: true, checkedInAt: true,
      order: { select: { code: true, quantity: true, status: true, buyerName: true } },
    },
  })
  if (!t) return { kind: 'unknown' }
  const base = {
    ticketId: t.id,
    holderLabel: t.holderName ?? `Invitado de ${t.order.buyerName}`,
    label: ticketLabel(t.order.code, t.seq),
    seq: t.seq,
    quantity: t.order.quantity,
  }
  if (t.order.status !== 'PAID') return { kind: 'cancelled', ...base }

  const r = await prisma.eventTicket.updateMany({
    where: { id: t.id, checkedInAt: null },
    data: { checkedInAt: now, checkedInById: adminId },
  })
  if (r.count === 1) return { kind: 'admitted', ...base, checkedInAt: now }

  const current = await prisma.eventTicket.findUnique({ where: { id: t.id }, select: { checkedInAt: true } })
  return { kind: 'already', ...base, checkedInAt: current?.checkedInAt ?? t.checkedInAt ?? undefined }
}

/** Deshacer un check-in recién hecho (máximo 30 s), para corregir un escaneo equivocado. */
export async function undoCheckIn(ticketId: string, now: Date = new Date()): Promise<boolean> {
  const r = await prisma.eventTicket.updateMany({
    where: { id: ticketId, checkedInAt: { gte: new Date(now.getTime() - 30_000) } },
    data: { checkedInAt: null, checkedInById: null },
  })
  return r.count === 1
}

export type TicketSearchRow = {
  ticketId: string; label: string; holderLabel: string; buyerName: string; buyerPhone: string; checkedInAt: string | null
}

/** Búsqueda manual en la puerta: código, titular, comprador o teléfono; solo pedidos pagados. */
export async function searchTickets(q: string): Promise<TicketSearchRow[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const digits = term.replace(/\D/g, '')
  const tickets = await prisma.eventTicket.findMany({
    where: {
      order: { status: 'PAID' },
      OR: [
        { holderName: { contains: term, mode: 'insensitive' } },
        { order: { buyerName: { contains: term, mode: 'insensitive' } } },
        { order: { code: { contains: term.toUpperCase().replace(/-\d+$/, '') } } },
        ...(digits.length >= 4 ? [{ holderPhone: { contains: digits } }, { order: { buyerPhone: { contains: digits } } }] : []),
      ],
    },
    take: 20,
    orderBy: [{ order: { buyerName: 'asc' } }, { seq: 'asc' }],
    select: {
      id: true, seq: true, holderName: true, checkedInAt: true,
      order: { select: { code: true, buyerName: true, buyerPhone: true } },
    },
  })
  return tickets.map((t) => ({
    ticketId: t.id,
    label: ticketLabel(t.order.code, t.seq),
    holderLabel: t.holderName ?? `Invitado de ${t.order.buyerName}`,
    buyerName: t.order.buyerName,
    buyerPhone: t.order.buyerPhone,
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
  }))
}

export async function countInside(): Promise<number> {
  return prisma.eventTicket.count({ where: { checkedInAt: { not: null }, order: { status: 'PAID' } } })
}
