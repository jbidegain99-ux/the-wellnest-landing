import { describe, it, expect } from 'vitest'
import { qaGateDecision } from './qaGate'

const basic = (user: string, pass: string): string => 'Basic ' + btoa(`${user}:${pass}`)

describe('qaGateDecision', () => {
  it('fuera de QA siempre deja pasar', () => {
    expect(
      qaGateDecision({ pathname: '/', authorization: null, password: undefined, qa: false })
    ).toBe('allow')
  })

  it('QA sin credenciales pide contraseña', () => {
    expect(
      qaGateDecision({ pathname: '/', authorization: null, password: 'secreta', qa: true })
    ).toBe('challenge')
  })

  it('QA con contraseña correcta', () => {
    expect(
      qaGateDecision({
        pathname: '/paquetes',
        authorization: basic('adriana', 'secreta'),
        password: 'secreta',
        qa: true,
      })
    ).toBe('allow')
  })

  it('QA con contraseña incorrecta', () => {
    expect(
      qaGateDecision({
        pathname: '/',
        authorization: basic('adriana', 'otra'),
        password: 'secreta',
        qa: true,
      })
    ).toBe('challenge')
  })

  it('QA sin QA_ACCESS_PASSWORD configurada', () => {
    for (const password of [undefined, '']) {
      expect(
        qaGateDecision({ pathname: '/', authorization: basic('adriana', ''), password, qa: true })
      ).toBe('challenge')
    }
  })

  it('headers malformados piden contraseña sin lanzar', () => {
    for (const authorization of ['Bearer secreta', 'Basic %%%no-base64%%%', 'Basic ' + btoa('sin-dos-puntos'), '']) {
      expect(
        qaGateDecision({ pathname: '/', authorization, password: 'secreta', qa: true })
      ).toBe('challenge')
    }
  })

  it('la contraseña puede contener dos puntos', () => {
    expect(
      qaGateDecision({ pathname: '/', authorization: basic('jose', 'a:b'), password: 'a:b', qa: true })
    ).toBe('allow')
  })

  it('rutas exentas', () => {
    for (const pathname of [
      '/api/payments/payway/callback',
      '/api/payments/payway/denied',
      '/api/webhooks/facturador',
      '/api/cron/sales-report',
      '/_next/static/x.js',
    ]) {
      expect(
        qaGateDecision({ pathname, authorization: null, password: 'secreta', qa: true })
      ).toBe('allow')
    }
  })

  it('prefijos parecidos no quedan exentos', () => {
    for (const pathname of ['/api/cron-falso', '/api/cron', '/api/payments/payway/init', '/api/webhooks/facturador-falso']) {
      expect(
        qaGateDecision({ pathname, authorization: null, password: 'secreta', qa: true })
      ).toBe('challenge')
    }
  })
})
