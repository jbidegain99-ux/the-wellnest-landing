import { prisma } from '@/lib/prisma'
import { ticketLabel } from './codes'
import { ticketPhase, type TicketPhase } from './ticketView'
import { shareTicketMessage, ticketUrl, waLink } from './whatsapp'

export type TicketPage = {
  phase: TicketPhase
  token: string
  url: string
  seq: number
  quantity: number
  label: string
  holderLabel: string
  holderFirstName: string
  buyerFirstName: string
  event: { name: string; startsAt: Date; endsAt: Date; venue: string }
  /** Solo para la entrada 1: las demás invitaciones del pedido, para pasarlas. */
  others: { seq: number; label: string; holderName: string | null; shareUrl: string }[]
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

export async function getTicketPage(token: string, now: Date = new Date()): Promise<TicketPage | null> {
  const t = await prisma.eventTicket.findUnique({
    where: { token },
    select: {
      seq: true, token: true, holderName: true, claimedAt: true, checkedInAt: true,
      event: { select: { name: true, startsAt: true, endsAt: true, venue: true } },
      order: {
        select: {
          code: true, quantity: true, status: true, buyerName: true,
          tickets: { select: { seq: true, token: true, holderName: true, claimedAt: true } },
        },
      },
    },
  })
  if (!t) return null

  const buyerFirst = firstName(t.order.buyerName)
  const holderLabel = t.holderName ?? `Invitado de ${t.order.buyerName}`
  const others =
    t.seq === 1
      ? t.order.tickets
          .filter((o) => o.seq !== 1)
          .sort((a, b) => a.seq - b.seq)
          .map((o) => ({
            seq: o.seq,
            label: ticketLabel(t.order.code, o.seq),
            holderName: o.holderName,
            shareUrl: waLink(shareTicketMessage({ buyerName: buyerFirst, token: o.token })),
          }))
      : []

  return {
    phase: ticketPhase({ orderStatus: t.order.status, claimedAt: t.claimedAt, checkedInAt: t.checkedInAt }, t.event, now),
    token: t.token,
    url: ticketUrl(t.token),
    seq: t.seq,
    quantity: t.order.quantity,
    label: ticketLabel(t.order.code, t.seq),
    holderLabel,
    holderFirstName: t.holderName ? firstName(t.holderName) : '',
    buyerFirstName: buyerFirst,
    event: t.event,
    others,
  }
}
