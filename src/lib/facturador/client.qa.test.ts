import { describe, it, expect, afterEach, vi } from 'vitest'
import { getFacturadorConfig } from './client'

// Candado I-4: QA solo factura contra api-qa de Facturo (o no factura)
describe('getFacturadorConfig en QA', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function stubFacturo(apiUrl: string) {
    vi.stubEnv('FACTURADOR_SV_API_URL', apiUrl)
    vi.stubEnv('FACTURADOR_SV_TENANT_ID', 'tenant-1')
    vi.stubEnv('FACTURADOR_SV_WEBHOOK_SECRET', 'secreto')
  }

  it('APP_ENV=qa con el host de producción: facturación deshabilitada (null) y aviso', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('APP_ENV', 'qa')
    stubFacturo('https://api.facturoelectronicosv.com')
    expect(getFacturadorConfig()).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('QA'))
  })

  it('APP_ENV=qa con URL inválida: null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('APP_ENV', 'qa')
    stubFacturo('no-es-una-url')
    expect(getFacturadorConfig()).toBeNull()
  })

  it('APP_ENV=qa con un host que solo contiene el de QA: null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('APP_ENV', 'qa')
    stubFacturo('https://api-qa.facturoelectronicosv.com.evil.example')
    expect(getFacturadorConfig()).toBeNull()
  })

  it('APP_ENV=qa con api-qa.facturoelectronicosv.com: configurado', () => {
    vi.stubEnv('APP_ENV', 'qa')
    stubFacturo('https://api-qa.facturoelectronicosv.com')
    expect(getFacturadorConfig()).toMatchObject({
      apiUrl: 'https://api-qa.facturoelectronicosv.com',
      tenantId: 'tenant-1',
    })
  })

  it('producción (sin APP_ENV) con el host de producción: configurado como siempre', () => {
    vi.stubEnv('APP_ENV', undefined)
    stubFacturo('https://api.facturoelectronicosv.com')
    expect(getFacturadorConfig()).toMatchObject({ apiUrl: 'https://api.facturoelectronicosv.com' })
  })
})
