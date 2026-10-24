import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  UNSUBSCRIBE_CONFIRM_PATH,
  unsubscribeToken,
  unsubscribeUrl,
  validUnsubscribeLink,
  verifyUnsubscribeToken,
} from './emailOptOut'

const SECRET = 'secreto-de-prueba'

describe('unsubscribeToken', () => {
  it('es determinista y es el HMAC-SHA256 hex de "progress-email:" + userId', () => {
    const a = unsubscribeToken('u1', SECRET)
    expect(a).toBe(unsubscribeToken('u1', SECRET))
    expect(a).toBe(createHmac('sha256', SECRET).update('progress-email:u1').digest('hex'))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('cambia con el usuario y con el secreto', () => {
    expect(unsubscribeToken('u1', SECRET)).not.toBe(unsubscribeToken('u2', SECRET))
    expect(unsubscribeToken('u1', SECRET)).not.toBe(unsubscribeToken('u1', 'otro'))
  })
})

describe('verifyUnsubscribeToken', () => {
  const good = unsubscribeToken('u1', SECRET)

  it('acepta el token correcto', () => {
    expect(verifyUnsubscribeToken('u1', good, SECRET)).toBe(true)
  })

  it('rechaza un token alterado', () => {
    const last = good.slice(-1) === '0' ? '1' : '0'
    expect(verifyUnsubscribeToken('u1', good.slice(0, -1) + last, SECRET)).toBe(false)
  })

  it('rechaza un token de otro largo sin lanzar', () => {
    expect(verifyUnsubscribeToken('u1', good.slice(0, 10), SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('u1', good + 'aa', SECRET)).toBe(false)
    expect(verifyUnsubscribeToken('u1', '', SECRET)).toBe(false)
  })

  it('rechaza el token de otra usuaria', () => {
    expect(verifyUnsubscribeToken('u2', good, SECRET)).toBe(false)
  })
})

describe('unsubscribeUrl', () => {
  it('apunta a la página de confirmación (un GET nunca da de baja) con u y t', () => {
    const url = new URL(unsubscribeUrl('https://wellneststudio.net', 'u1', SECRET))
    expect(url.origin).toBe('https://wellneststudio.net')
    expect(url.pathname).toBe('/correo/baja/confirmar')
    expect(UNSUBSCRIBE_CONFIRM_PATH).toBe('/correo/baja/confirmar')
    expect(url.searchParams.get('u')).toBe('u1')
    expect(url.searchParams.get('t')).toBe(unsubscribeToken('u1', SECRET))
  })

  it('tolera la barra final en la base', () => {
    expect(unsubscribeUrl('https://x.test/', 'u1', SECRET)).toMatch(/^https:\/\/x\.test\/correo\/baja\/confirmar\?/)
  })
})

describe('validUnsubscribeLink', () => {
  const good = unsubscribeToken('u1', SECRET)

  it('devuelve u y t si la firma es válida', () => {
    expect(validUnsubscribeLink('u1', good, SECRET)).toEqual({ userId: 'u1', token: good })
  })

  it('null si falta algo, la firma es mala o llegan valores repetidos', () => {
    expect(validUnsubscribeLink(undefined, good, SECRET)).toBeNull()
    expect(validUnsubscribeLink('u1', null, SECRET)).toBeNull()
    expect(validUnsubscribeLink('', '', SECRET)).toBeNull()
    expect(validUnsubscribeLink('u2', good, SECRET)).toBeNull()
    expect(validUnsubscribeLink(['u1', 'u1'], good, SECRET)).toBeNull()
    expect(validUnsubscribeLink('u1', [good], SECRET)).toBeNull()
  })
})
