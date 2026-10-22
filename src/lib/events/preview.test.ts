import { describe, it, expect } from 'vitest'
import { ticketPreview } from './preview'

const base = { holderLabel: 'Ana Martínez', buyerFirstName: 'Ana', label: 'HW-6CN4-1', seq: 1, quantity: 2, eventName: 'The Villains Ball' }

describe('ticketPreview', () => {
  it('ready: muestra QR, nombre y etiqueta', () =>
    expect(ticketPreview({ ...base, phase: 'ready' })).toEqual({
      showQr: true, kicker: 'THE SOUL HUB TE ESPERA', name: 'Ana Martínez', footer: 'ADMITE A UNA PERSONA · HW-6CN4-1',
    }))
  it('unclaimed: sin QR, invita a dejar datos', () =>
    expect(ticketPreview({ ...base, phase: 'unclaimed', seq: 2, label: 'HW-6CN4-2' })).toEqual({
      showQr: false, kicker: 'ANA TE INVITA A', name: 'Tu invitación', footer: 'Abrí el enlace y dejá tus datos para recibir tu QR',
    }))
  it('cancelled: sin QR', () => expect(ticketPreview({ ...base, phase: 'cancelled' }).showQr).toBe(false))
  it('después del show: sin QR, agradecimiento', () =>
    expect(ticketPreview({ ...base, phase: 'after-attended' })).toMatchObject({ showQr: false, name: 'Gracias por venir' }))
  it('anulada muestra el nombre del evento', () =>
    expect(ticketPreview({ ...base, eventName: 'Vintage Pilates', phase: 'cancelled' }).kicker).toBe('VINTAGE PILATES'))
})
