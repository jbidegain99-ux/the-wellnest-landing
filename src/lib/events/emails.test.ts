import { describe, it, expect } from 'vitest'
import { buildPaymentInstructionsEmail, escapeHtml } from './emails'

describe('emails del evento', () => {
  it('escapeHtml', () => expect(escapeHtml(`<b>"A" & 'B'</b>`)).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;'))
  it('instrucciones de pago', () => {
    const html = buildPaymentInstructionsEmail({ buyerName: '<b>Ana</b> & Co', code: 'HW-7K3P', amountCents: 2000, quantity: 2, orderUrl: 'https://x/halloween/pedido/t' })
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; Co')
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('HW-7K3P')
    expect(html).toContain('$20.00')
    expect(html).toContain('152301000036454')
    expect(html).toContain('The Wellnest')
    expect(html).toContain('agregá este código en el campo')
    expect(html).toContain('https://x/halloween/pedido/t')
  })
})
