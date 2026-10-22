// Configuración de The Villains Ball. Los datos bancarios no son secretos:
// se muestran en la página de pago.

export const VILLAINS_BALL_SLUG = 'villains-ball'
export const EVENT_ORDER_MAX_QTY = 6
export const EVENT_ORDER_HOLD_HOURS = 24
export const EVENT_CODE_PREFIX = 'HW-'

export const EVENT_BANK = {
  name: 'Banco Cuscatlán',
  accountType: 'Cuenta corriente',
  account: '152301000036454',
  holder: 'The Wellnest',
} as const

export const EVENT_STUDIO_WHATSAPP = '+50377923957'

export function siteUrl(): string {
  return (process.env.NEXTAUTH_URL ?? 'https://wellneststudio.net').replace(/\/$/, '')
}

// Textos de fecha y lugar tal cual en los artboards (evento único)
export const EVENT_DATE_LINE = 'VIERNES 30 DE OCTUBRE · 6:30 P. M.'
export const EVENT_VENUE_LINE = 'Plaza Presidente · Nivel 3 · San Salvador'
