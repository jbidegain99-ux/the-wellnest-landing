import { describe, it, expect } from 'vitest'
import { buildPaymentInstructionsEmail, buildTicketsEmail, buildThanksEmail, escapeHtml } from './emails'

const EVENT = { name: 'The Villains Ball', startsAt: new Date('2026-10-31T00:30:00Z'), venue: 'Plaza Presidente · Nivel 3 · San Salvador', thanksMessage: null as string | null }

describe('emails del evento', () => {
  it('escapeHtml', () => expect(escapeHtml(`<b>"A" & 'B'</b>`)).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;'))
  it('instrucciones de pago', () => {
    const html = buildPaymentInstructionsEmail({ buyerName: '<b>Ana</b> & Co', code: 'HW-7K3P', amountCents: 2000, quantity: 2, orderUrl: 'https://x/halloween/pedido/t', event: EVENT })
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; Co')
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('HW-7K3P')
    expect(html).toContain('$20.00')
    expect(html).toContain('152301000036454')
    expect(html).toContain('The Wellnest')
    expect(html).toContain('agregá este código en el campo')
    expect(html).toContain('https://x/halloween/pedido/t')
  })
  it('correo de entradas', () => {
    const html = buildTicketsEmail({ buyerName: 'Ana <3', tickets: [{ label: 'HW-7K3P-1', url: 'https://x/entrada/a' }, { label: 'HW-7K3P-2', url: 'https://x/entrada/b' }], event: EVENT })
    expect(html).toContain('Ana &lt;3')
    expect(html).toContain('https://x/entrada/a')
    expect(html).toContain('https://x/entrada/b')
    expect(html).toContain('HW-7K3P-2')
  })
  it('correo de agradecimiento', () => {
    const html = buildThanksEmail({ name: 'Ana & <Co>', ticketUrl: 'https://x/entrada/a', event: EVENT })
    expect(html).toContain('Ana &amp; &lt;Co&gt;')
    expect(html).toContain('https://x/entrada/a')
    expect(html).toContain('Activala')
  })
  it('encabezado y pie salen del evento (escapados)', () => {
    const html = buildTicketsEmail({ buyerName: 'Ana', tickets: [{ label: 'VP-AAAA-1', url: 'https://x/e/a' }], event: { ...EVENT, name: 'Vintage <Pilates>', startsAt: new Date('2026-11-14T15:00:00Z'), venue: 'Wellnest Studio' } })
    expect(html).toContain('VINTAGE &lt;PILATES&gt;')
    expect(html).toContain('Sábado 14 de noviembre · 9:00 a. m. · Wellnest Studio')
    expect(html).not.toContain('VILLAINS')
  })
  it('gracias: usa el mensaje del evento o uno genérico', () => {
    expect(buildThanksEmail({ name: 'Ana', ticketUrl: 'u', event: { ...EVENT, thanksMessage: 'Mensaje <propio>' } })).toContain('Mensaje &lt;propio&gt;')
    expect(buildThanksEmail({ name: 'Ana', ticketUrl: 'u', event: { ...EVENT, name: 'Vintage Pilates' } })).toContain('Fue un honor tenerte en Vintage Pilates.')
  })
})
