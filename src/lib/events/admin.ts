import type { EventOrderStatus, Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isOrderExpired, seatsTaken } from './orders'
import { ticketLabel } from './codes'
import { buyerTicketsMessage, waLink } from './whatsapp'

/** id del admin en sesión, o null si no es ADMIN. */
export async function getAdminId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session.user.id : null
}

export type AdminTab = 'pendientes' | 'pagados' | 'otros'

export function adminOrdersWhere(eventId: string, tab: AdminTab, q: string, now: Date): Prisma.EventOrderWhereInput {
  const and: Prisma.EventOrderWhereInput[] = []
  if (tab === 'pendientes') and.push({ status: 'PENDING', expiresAt: { gt: now } })
  else if (tab === 'pagados') and.push({ status: 'PAID' })
  else and.push({ OR: [{ status: 'CANCELLED' }, { status: 'PENDING', expiresAt: { lte: now } }] })

  const term = q.trim()
  if (term) {
    const or: Prisma.EventOrderWhereInput[] = [
      { code: { contains: term.toUpperCase() } },
      { buyerName: { contains: term, mode: 'insensitive' } },
      { buyerEmail: { contains: term, mode: 'insensitive' } },
    ]
    const digits = term.replace(/\D/g, '')
    // Solo con 4+ dígitos: un código como HW-7K3P no debe traer todos los teléfonos con un 7
    if (digits.length >= 4) or.push({ buyerPhone: { contains: digits } })
    and.push({ OR: or })
  }
  return { eventId, AND: and }
}

export type AdminOrderRow = {
  id: string
  code: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  quantity: number
  amountCents: number
  status: EventOrderStatus
  expired: boolean
  createdAt: string
  paidAt: string | null
  whatsappSentAt: string | null
  adminNote: string | null
  whatsappUrl: string | null
  tickets: { seq: number; label: string; holderName: string | null; claimed: boolean; checkedInAt: string | null }[]
}

export type AdminCounts = { paidTickets: number; pendingTickets: number; checkedIn: number; capacity: number | null }

export async function listAdminOrders(
  slug: string,
  tab: AdminTab,
  q: string,
  now: Date = new Date()
): Promise<{ orders: AdminOrderRow[]; counts: AdminCounts } | null> {
  const event = await prisma.event.findUnique({ where: { slug } })
  if (!event) return null

  const [orders, paidAgg, taken, checkedIn] = await Promise.all([
    prisma.eventOrder.findMany({
      where: adminOrdersWhere(event.id, tab, q, now),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tickets: { orderBy: { seq: 'asc' } } },
    }),
    prisma.eventOrder.aggregate({ where: { eventId: event.id, status: 'PAID' }, _sum: { quantity: true } }),
    seatsTaken(prisma, event.id, now),
    prisma.eventTicket.count({ where: { eventId: event.id, checkedInAt: { not: null }, order: { status: 'PAID' } } }),
  ])
  const paidTickets = paidAgg._sum.quantity ?? 0

  return {
    counts: { paidTickets, pendingTickets: taken - paidTickets, checkedIn, capacity: event.capacity },
    orders: orders.map((o) => {
      const first = o.tickets.find((t) => t.seq === 1)
      return {
        id: o.id,
        code: o.code,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        buyerPhone: o.buyerPhone,
        quantity: o.quantity,
        amountCents: o.amountCents,
        status: o.status,
        expired: isOrderExpired(o, now),
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
        whatsappSentAt: o.whatsappSentAt?.toISOString() ?? null,
        adminNote: o.adminNote,
        whatsappUrl:
          o.status === 'PAID' && first
            ? waLink(
                buyerTicketsMessage({ buyerName: o.buyerName.split(' ')[0] ?? o.buyerName, firstTicketToken: first.token, quantity: o.quantity }),
                o.buyerPhone
              )
            : null,
        tickets: o.tickets.map((t) => ({
          seq: t.seq,
          label: ticketLabel(o.code, t.seq),
          holderName: t.holderName,
          claimed: t.claimedAt !== null,
          checkedInAt: t.checkedInAt?.toISOString() ?? null,
        })),
      }
    }),
  }
}
