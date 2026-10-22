import { siteUrl } from './config'
import { waNumber } from './phone'
import { eventDateSentence } from './format'

export type EventCopy = { name: string; startsAt: Date; venue: string }

export function waLink(text: string, phoneE164?: string): string {
  const number = phoneE164 ? waNumber(phoneE164) : ''
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function ticketUrl(token: string): string {
  return `${siteUrl()}/entrada/${token}`
}

export function buyerTicketsMessage(p: { buyerName: string; firstTicketToken: string; quantity: number; event: EventCopy }): string {
  const when = eventDateSentence(p.event.startsAt)
  const lines = [
    `¡Hola ${p.buyerName}! Tu pago está confirmado. Esta es tu invitación para ${p.event.name} (${when.charAt(0).toLowerCase()}${when.slice(1)}, ${p.event.venue}):`,
    ticketUrl(p.firstTicketToken),
  ]
  if (p.quantity > 1) {
    lines.push(`Tus otras ${p.quantity - 1} invitaciones están en tu entrada, en el botón «Pasar invitación».`)
  }
  return lines.join('\n')
}

export function shareTicketMessage(p: { buyerName: string; token: string; eventName: string }): string {
  return `${p.buyerName} te invita a ${p.eventName}. Abrí tu invitación y dejá tus datos para recibir tu QR: ${ticketUrl(p.token)}`
}

export function proofMessage(code: string): string {
  return `Hola, envío el comprobante de mi pedido ${code}`
}
