import { describe, it, expect } from 'vitest'
import { qrPngDataUrl } from './qr'

describe('qrPngDataUrl', () => {
  it('genera un PNG en data URL', async () => {
    const url = await qrPngDataUrl('https://wellneststudio.net/entrada/abc')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(url.length).toBeGreaterThan(500)
  })
})
