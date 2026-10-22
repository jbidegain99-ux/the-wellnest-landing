import type { TicketPhase } from './ticketView'

export type TicketPreview = { showQr: boolean; kicker: string; name: string; footer: string }

/** Textos de la imagen de vista previa (WhatsApp) según el estado de la entrada. */
export function ticketPreview(p: {
  phase: TicketPhase; holderLabel: string; buyerFirstName: string; label: string; seq: number; quantity: number; eventName: string
}): TicketPreview {
  switch (p.phase) {
    case 'ready':
      return { showQr: true, kicker: 'THE SOUL HUB TE ESPERA', name: p.holderLabel, footer: `ADMITE A UNA PERSONA · ${p.label}` }
    case 'unclaimed':
      return {
        showQr: false,
        kicker: `${p.buyerFirstName.toUpperCase()} TE INVITA A`,
        name: 'Tu invitación',
        footer: 'Abrí el enlace y dejá tus datos para recibir tu QR',
      }
    case 'cancelled':
      return { showQr: false, kicker: p.eventName.toUpperCase(), name: 'Invitación anulada', footer: p.label }
    case 'after-attended':
    case 'after-missed':
      return { showQr: false, kicker: p.eventName.toUpperCase(), name: 'Gracias por venir', footer: 'Activá tu cuenta en Wellnest' }
  }
}
