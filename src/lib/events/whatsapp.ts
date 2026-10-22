import { siteUrl } from './config'
import { waNumber } from './phone'

export function waLink(text: string, phoneE164?: string): string {
  const number = phoneE164 ? waNumber(phoneE164) : ''
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export function ticketUrl(token: string): string {
  return `${siteUrl()}/entrada/${token}`
}

export function buyerTicketsMessage(p: { buyerName: string; firstTicketToken: string; quantity: number }): string {
  const lines = [
    `¡Hola ${p.buyerName}! Tu pago está confirmado. Esta es tu invitación para The Villains Ball (viernes 30 de octubre, 6:30 p. m., Plaza Presidente nivel 3):`,
    ticketUrl(p.firstTicketToken),
  ]
  if (p.quantity > 1) {
    lines.push(`Tus otras ${p.quantity - 1} invitaciones están en tu entrada, en el botón «Pasar invitación».`)
  }
  return lines.join('\n')
}

export function shareTicketMessage(p: { buyerName: string; token: string }): string {
  return `${p.buyerName} te invita a The Villains Ball. Abrí tu invitación y dejá tus datos para recibir tu QR: ${ticketUrl(p.token)}`
}

export function proofMessage(code: string): string {
  return `Hola, envío el comprobante de mi pedido ${code}`
}
