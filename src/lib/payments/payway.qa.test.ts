import { describe, it, expect, afterEach, vi } from 'vitest'
import { getPaywayConfig } from './payway'

// Candado I-4: QA nunca cobra con la pasarela real
describe('getPaywayConfig en QA', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('APP_ENV=qa con PAYWAY_ENV=PROD lanza', () => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('PAYWAY_ENV', 'PROD')
    expect(() => getPaywayConfig()).toThrow(/QA.*PAYWAY_ENV=PROD/)
  })

  it('APP_ENV=qa con PAYWAY_ENV=TEST usa el sandbox', () => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('PAYWAY_ENV', 'TEST')
    vi.stubEnv('PAYWAY_BASE_URL_TEST', '')
    expect(getPaywayConfig()).toMatchObject({ env: 'TEST', baseUrl: 'https://test.payway.sv' })
  })

  it('APP_ENV=qa sin PAYWAY_ENV cae en TEST', () => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('PAYWAY_ENV', undefined)
    expect(getPaywayConfig().env).toBe('TEST')
  })

  it('producción (sin APP_ENV) con PAYWAY_ENV=PROD sigue igual', () => {
    vi.stubEnv('APP_ENV', undefined)
    vi.stubEnv('PAYWAY_ENV', 'PROD')
    vi.stubEnv('PAYWAY_BASE_URL_PROD', '')
    expect(getPaywayConfig()).toMatchObject({ env: 'PROD', baseUrl: 'https://www.payway.sv' })
  })
})
