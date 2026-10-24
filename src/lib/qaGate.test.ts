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

  it('archivos estáticos de /public y robots.txt quedan exentos', () => {
    for (const pathname of [
      '/images/hero-section.jpeg',
      '/images/team/foto.jpg',
      '/halloween/telon.jpg',
      '/halloween/invitacion.jpg',
      '/favicon.ico',
      '/favicon.svg',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-maskable-192.png',
      '/manifest.json',
      '/sw.js',
      '/offline.html',
      '/robots.txt',
    ]) {
      expect(
        qaGateDecision({ pathname, authorization: null, password: 'secreta', qa: true }),
        pathname
      ).toBe('allow')
    }
  })

  it('las páginas que comparten carpeta con /public siguen bloqueadas', () => {
    for (const pathname of ['/halloween', '/halloween/pedido/abc123', '/halloween/telon.jpg/x']) {
      expect(
        qaGateDecision({ pathname, authorization: null, password: 'secreta', qa: true }),
        pathname
      ).toBe('challenge')
    }
  })

  it('archivos parecidos a los exentos no quedan exentos', () => {
    for (const pathname of [
      '/images-falso/x.jpg',
      '/images',
      '/robots.txt.bak',
      '/manifest.json/x',
      '/sw.js.map',
      '/icon-192.png.html',
      '/favicon.ico/x',
    ]) {
      expect(
        qaGateDecision({ pathname, authorization: null, password: 'secreta', qa: true }),
        pathname
      ).toBe('challenge')
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
