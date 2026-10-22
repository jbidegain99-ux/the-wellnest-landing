import { describe, it, expect, beforeEach } from 'vitest'
import { waLink, ticketUrl, buyerTicketsMessage, shareTicketMessage, proofMessage } from './whatsapp'

describe('whatsapp', () => {
  beforeEach(() => { process.env.NEXTAUTH_URL = 'https://wellneststudio.net' })
  it('link con teléfono y texto codificado', () =>
    expect(waLink('Hola & <Ana> 🎃', '+50377923957')).toBe('https://wa.me/50377923957?text=' + encodeURIComponent('Hola & <Ana> 🎃')))
  it('link sin teléfono', () => expect(waLink('x')).toBe('https://wa.me/?text=x'))
  it('url de la entrada', () => expect(ticketUrl('abc')).toBe('https://wellneststudio.net/entrada/abc'))
  it('mensaje al comprador con 1 entrada', () => {
    const m = buyerTicketsMessage({ buyerName: 'Ana', firstTicketToken: 'abc', quantity: 1 })
    expect(m).toContain('¡Hola Ana!')
    expect(m).toContain('https://wellneststudio.net/entrada/abc')
    expect(m).not.toContain('Pasar invitación')
  })
  it('mensaje al comprador con 3 entradas menciona pasar invitaciones', () =>
    expect(buyerTicketsMessage({ buyerName: 'Ana', firstTicketToken: 'abc', quantity: 3 }))
      .toContain('Tus otras 2 invitaciones están en tu entrada, en el botón «Pasar invitación».'))
  it('mensaje para compartir', () =>
    expect(shareTicketMessage({ buyerName: 'Ana', token: 't2' })).toBe(
      'Ana te invita a The Villains Ball. Abrí tu invitación y dejá tus datos para recibir tu QR: https://wellneststudio.net/entrada/t2'))
  it('comprobante', () => expect(proofMessage('HW-7K3P')).toBe('Hola, envío el comprobante de mi pedido HW-7K3P'))
})
