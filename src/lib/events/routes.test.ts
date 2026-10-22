import { describe, it, expect } from 'vitest'
import { hidesSiteChrome } from './routes'

describe('hidesSiteChrome', () => {
  it.each(['/admin', '/admin/eventos', '/halloween', '/halloween/pedido/abc', '/entrada/abc', '/eventos/vintage-pilates', '/eventos/pedido/abc'])('oculta en %s', (p) =>
    expect(hidesSiteChrome(p)).toBe(true))
  it.each(['/', '/paquetes', '/halloweenx', '/entradas', '/eventos', null])('muestra en %s', (p) => expect(hidesSiteChrome(p)).toBe(false))
})
